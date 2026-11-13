import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const tx = vi.hoisted(() => ({ transaction: { updateMany: vi.fn(), create: vi.fn() } }));
const prismaMock = vi.hoisted(() => ({
  transaction: { findUnique: vi.fn() },
  organisation: { findUnique: vi.fn() },
  userRole: { findMany: vi.fn().mockResolvedValue([]) },
  user: { findUnique: vi.fn().mockResolvedValue(null) },
  $transaction: vi.fn(),
}));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn() }));
vi.mock('@/lib/sms', () => ({ sendSms: vi.fn() }));
vi.mock('@/lib/balance', () => ({ getOrganisationApprovedBalance: async () => 0 }));
vi.mock('@/lib/organisations', () => ({
  hasOrganisationAccess: async (u: { organisationId?: string }, id: string) => id === u.organisationId,
}));

import { POST } from './route';

const original = (over: Record<string, unknown> = {}) => ({
  id: 'tx-1', type: 'EXPENSE', amount: '100', status: 'APPROVED', correctedAt: null,
  organisationId: 'campus-b', description: 'x', currencyId: null, exchangeRate: null,
  weekNumber: 99, year: 9999, currency: null,
  organisation: { id: 'campus-b', name: 'B', level: 'COUNCIL' },
  ...over,
});
const call = (body: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'tx-1' }),
  });

describe('POST /api/transactions/[id]/correct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = { user: { id: 'me', role: 'CAMPUS_ADMIN', organisationId: 'campus-a', activeUserRole: { organisationId: 'campus-a' } } };
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
    tx.transaction.updateMany.mockResolvedValue({ count: 1 });
    tx.transaction.create.mockResolvedValue({ id: 'new', organisation: {}, currency: null });
  });

  it('403s a cross-campus correction with no rows created', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original());
    const res = await call({ newAmount: 50 });
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('403s moving an in-scope transaction into a foreign account', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a' }));
    const res = await call({ newOrganisationId: 'campus-b' });
    expect(res.status).toBe(403);
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects non-approved originals', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a', status: 'PENDING' }));
    expect((await call({ newAmount: 50 })).status).toBe(400);
  });

  it('rejects an already-corrected original (replay)', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a', correctedAt: new Date() }));
    expect((await call({ newAmount: 50 })).status).toBe(409);
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects a lost race on the atomic claim without creating rows', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a' }));
    tx.transaction.updateMany.mockResolvedValue({ count: 0 });
    const res = await call({ newAmount: 50 });
    expect(res.status).toBe(409);
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects negative new amounts', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a' }));
    expect((await call({ newAmount: -5 })).status).toBe(400);
  });

  it('applies an in-scope correction once and does not leak requester contact details', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(original({ organisationId: 'campus-a', weekNumber: 1, year: 1 }));
    session.current.user.role = 'OVERSIGHT_ADMIN';
    const res = await call({ newAmount: 50 });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(tx.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(json.originalTransaction).not.toHaveProperty('user');
  });
});
