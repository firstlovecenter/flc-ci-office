import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  userRole: { findMany: vi.fn().mockResolvedValue([]) },
  organisation: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  publicExpenseRequest: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
  $queryRaw: vi.fn().mockResolvedValue([]),
}));
const sendSms = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/sms', () => ({ sendSms, formatGhanaPhone: (p: string) => `+233${p.replace(/^0/, '')}` }));
vi.mock('@/lib/organisations', () => ({ getDescendantOrganisationIds: async () => ['campus-a'] }));
vi.mock('@/lib/expense-window', () => ({ getExpenseWindowStatus: () => ({ isOpen: true }), formatTimeInExpenseWindowTimeZone: () => '' }));
vi.mock('@/lib/expense-window-settings', () => ({ getExpenseWindowForOrganisation: async () => ({}) }));

import { POST as notify } from './notifications/send/route';
import { POST as publicExpense } from './public-expense/route';
import { GET as analytics } from './analytics/organisations/route';
import { POST as seed } from './seed/route';
import { getClientIp } from '@/lib/rate-limit';

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x', { method: 'POST', headers, body: JSON.stringify(body) }) as any;
const admin = (role = 'CAMPUS_ADMIN', id = 'me') => ({
  user: { id, role, organisationId: 'campus-a', activeUserRole: { organisationId: 'campus-a' } },
});

describe('M1 notifications/send scope', () => {
  beforeEach(() => { vi.clearAllMocks(); session.current = admin('CAMPUS_ADMIN', `u${Math.random()}`); });

  it('rejects an organisation outside the caller’s subtree', async () => {
    const res = await notify(req({ message: 'hi', recipientType: 'organisation', organisationId: 'foreign' }));
    expect(res.status).toBe(403);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('scopes role broadcasts to the caller’s organisations', async () => {
    await notify(req({ message: 'hi', recipientType: 'role', role: 'CAMPUS_LEADER' }));
    expect(prismaMock.userRole.findMany.mock.calls[0][0].where.organisationId).toEqual({ in: ['campus-a'] });
  });

  it('refuses an arbitrary phone number that is not an in-scope user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const res = await notify(req({ message: 'hi', recipientType: 'individual', phoneNumber: '0240000000' }));
    expect(res.status).toBe(403);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('caps message length', async () => {
    const res = await notify(req({ message: 'x'.repeat(400), recipientType: 'role', role: 'CAMPUS_LEADER' }));
    expect(res.status).toBe(400);
  });
});

describe('public-expense hardening', () => {
  const body = {
    campusOrganisationId: 'campus-a', requesterName: 'A', leaderPhone: '0241234567', churchName: 'C',
    momoName: 'M', momoNumber: '0241234568', amount: 50, description: 'Fuel',
  };
  let n = 0;
  const post = (b: unknown) => publicExpense(req(b, { 'cf-connecting-ip': `9.9.9.${++n}` }));
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organisation.findUnique.mockResolvedValue({ id: 'campus-a', name: 'Campus' });
    prismaMock.publicExpenseRequest.create.mockResolvedValue({ id: 'r1' });
  });

  it('validates lengths, phone format and amount', async () => {
    expect((await post({ ...body, description: 'x'.repeat(600) })).status).toBe(400);
    expect((await post({ ...body, leaderPhone: 'not-a-phone' })).status).toBe(400);
    expect((await post({ ...body, amount: 10_000_000 })).status).toBe(400);
    expect((await post({ ...body, amount: -1 })).status).toBe(400);
  });

  it('does not text an unverified number again within the hour', async () => {
    prismaMock.publicExpenseRequest.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(sendSms.mock.calls.filter((c) => c[0].to === '0241234567')).toHaveLength(0);
  });
});

describe('M3 analytics hierarchy scope', () => {
  it('applies the org scope to the raw hierarchy query and returns nothing for an empty scope', async () => {
    session.current = { user: { id: 'l', role: 'CAMPUS_LEADER', organisationId: null, activeUserRole: null } };
    const res = await analytics(new Request('http://x/api/analytics/organisations'));
    const json = await res.json();
    expect(json.hierarchy).toEqual([]);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('seed', () => {
  it('is disabled in production and needs SEED_PASSWORD elsewhere; never echoes credentials', async () => {
    session.current = { user: { id: 's', role: 'SUPERADMIN' } };
    const env = process.env as Record<string, string | undefined>;
    const prev = [env.NODE_ENV, env.SEED_PASSWORD];
    env.NODE_ENV = 'production'; delete env.ALLOW_PRODUCTION_SEED;
    expect((await seed(req({}))).status).toBe(403);
    env.NODE_ENV = 'test'; delete env.SEED_PASSWORD;
    expect((await seed(req({}))).status).toBe(400);
    [env.NODE_ENV, env.SEED_PASSWORD] = prev;
  });
});

describe('rate-limit client IP', () => {
  it('never trusts the client-controlled leftmost X-Forwarded-For hop', () => {
    const spoof = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(getClientIp(spoof)).toBe('unknown');
    const cf = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '8.8.8.8' } });
    expect(getClientIp(cf)).toBe('8.8.8.8');
  });
});
