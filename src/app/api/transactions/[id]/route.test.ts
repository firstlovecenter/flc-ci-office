import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const prismaMock = vi.hoisted(() => ({
  transaction: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
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
vi.mock('@/lib/organisations', () => ({
  hasOrganisationAccess: async (u: { organisationId?: string }, id: string) => id === u.organisationId,
}));

import { PUT, PATCH } from './route';

const existing = {
  id: 't1', type: 'EXPENSE', amount: '100', description: 'd', organisationId: 'campus-a',
  weekNumber: 1, year: 1, locked: false, status: 'PENDING', createdAt: new Date(),
  organisation: { name: 'A', level: 'COUNCIL' }, user: { name: 'u' }, currency: { symbol: '₵' },
};
const req = (body: unknown, method = 'PUT') => new Request('http://x', { method, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: 't1' }) };

describe('/api/transactions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = { user: { id: 'me', role: 'OVERSIGHT_ADMIN', organisationId: 'campus-a', activeUserRole: { organisationId: 'campus-a' } } };
    prismaMock.transaction.findUnique.mockResolvedValue(existing);
    prismaMock.transaction.update.mockResolvedValue({ ...existing, organisation: { id: 'campus-a', name: 'A', level: 'COUNCIL' }, user: {}, currency: { symbol: '₵' } });
  });

  it('403s moving a transaction into another campus’ account; row unchanged', async () => {
    const res = await PUT(req({ type: 'EXPENSE', amount: 10, description: 'd', organisationId: 'campus-b' }), ctx);
    expect(res.status).toBe(403);
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects zero/negative amounts', async () => {
    for (const amount of [0, -3]) {
      const res = await PUT(req({ type: 'EXPENSE', amount, description: 'd', organisationId: 'campus-a' }), ctx);
      expect(res.status).toBe(400);
    }
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('approvedAmount writes amount and amountInBase together, and rejects invalid values', async () => {
    const bad = await PATCH(req({ status: 'APPROVED', approvedAmount: -1 }, 'PATCH'), ctx);
    expect(bad.status).toBe(400);
    await PATCH(req({ status: 'APPROVED', approvedAmount: 42.5 }, 'PATCH'), ctx);
    expect(prismaMock.transaction.update.mock.calls[0][0].data).toMatchObject({ amount: '42.50', amountInBase: '42.50' });
  });
});
