import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const prismaMock = vi.hoisted(() => ({
  transaction: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  organisation: { findUnique: vi.fn() },
  userRole: { findMany: vi.fn().mockResolvedValue([]) },
  user: { findUnique: vi.fn().mockResolvedValue(null) },
  auditLog: { create: vi.fn() },
}));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/sms', () => ({ sendSms: vi.fn() }));
vi.mock('@/lib/balance', () => ({ getOrganisationApprovedBalance: async () => 0 }));
vi.mock('@/lib/currency', () => ({ getAppCurrency: async () => ({ id: 'ghs' }) }));
vi.mock('@/lib/approval-admins', () => ({ getApprovalAdmins: async () => [] }));
vi.mock('@/lib/organisations', () => ({
  hasOrganisationAccess: async () => true,
  getDescendantOrganisationIds: async () => ['acct'],
}));

import { POST } from './route';

const body = { type: 'INCOME', amount: 100, description: '', organisationId: 'acct' };
const post = (b: unknown, key?: string) =>
  POST(new Request('http://x', {
    method: 'POST',
    headers: key ? { 'Idempotency-Key': key } : {},
    body: JSON.stringify(b),
  }));
const created = { id: 't1', status: 'APPROVED', organisationId: 'acct', organisation: { name: 'A', level: 'COUNCIL' }, currency: null };
const KEY = 'abcdefgh-1234';

describe('POST /api/transactions — duplicates and idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = { user: { id: 'me', role: 'CAMPUS_ADMIN', name: 'Me', organisationId: 'acct', activeUserRole: { organisationId: 'acct' } } };
    prismaMock.organisation.findUnique.mockResolvedValue({ id: 'acct', name: 'A', level: 'COUNCIL', accountType: 'OPERATING' });
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.create.mockResolvedValue(created);
  });

  it('allows an empty description for a deposit', async () => {
    expect((await post(body)).status).toBe(200);
  });

  it('409s with the earlier same-day entries and writes nothing', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: 'old', description: 'Tithe', amount: '100', status: 'APPROVED', createdAt: new Date(), user: { name: 'Ama' } },
    ]);
    const res = await post(body);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe('POSSIBLE_DUPLICATE');
    expect(json.duplicates[0]).toMatchObject({ id: 'old', enteredBy: 'Ama' });
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    const where = prismaMock.transaction.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organisationId: 'acct', type: 'INCOME', amount: '100.00', isCharge: false });
  });

  it('saves once the user confirms it is a separate transaction', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 'old', amount: '100', status: 'APPROVED', createdAt: new Date(), user: null }]);
    const res = await post({ ...body, confirmDuplicate: true });
    expect(res.status).toBe(200);
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('stores the user-scoped idempotency key on create', async () => {
    await post(body, KEY);
    expect(prismaMock.transaction.create.mock.calls[0][0].data.idempotencyKey).toBe(`me:${KEY}`);
  });

  it('replays the original row for a repeated key — no second row, no duplicate prompt', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(created);
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 't1' }]);
    const res = await post(body, KEY);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ id: 't1', idempotentReplay: true });
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });

  it('turns a concurrent-insert unique violation into a replay', async () => {
    prismaMock.transaction.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
    prismaMock.transaction.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = await post(body, KEY);
    expect(res.status).toBe(200);
    expect((await res.json()).idempotentReplay).toBe(true);
  });

  it('a request that raced in just before the duplicate check is a replay, not a duplicate', async () => {
    prismaMock.transaction.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 't1', amount: '100', status: 'APPROVED', createdAt: new Date(), user: null }]);
    const res = await post(body, KEY);
    expect(res.status).toBe(200);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed key', async () => {
    expect((await post(body, 'x')).status).toBe(400);
  });
});
