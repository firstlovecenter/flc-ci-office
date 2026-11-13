import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const tx = vi.hoisted(() => ({
  user: { create: vi.fn(), update: vi.fn() },
  userRole: { createMany: vi.fn(), deleteMany: vi.fn() },
  passwordReset: { updateMany: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  userRole: { count: vi.fn() },
  organisation: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('next-auth/next', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/password-reset', () => ({ sendSetupLinkEmail: vi.fn() }));
vi.mock('@/lib/roleValidation', () => ({ validateRoleAssignment: async () => ({ valid: true }) }));
vi.mock('@/lib/organisations', () => ({
  getDescendantOrganisationIds: async () => ['campus-a', 'acct-a'],
}));

import { GET, PUT, PATCH } from './[id]/route';
import { POST } from './route';

const mkSession = (role = 'CAMPUS_ADMIN') => ({
  user: { id: 'me', role, organisationId: 'campus-a', activeUserRole: { organisationId: 'campus-a' } },
});
const target = (over: Record<string, unknown> = {}) => ({
  id: 't', archived: false, organisationId: null, activeRole: null, userRoles: [], ...over,
});
const ctx = { params: Promise.resolve({ id: 't' }) };
const json = (method: string, body: unknown) => new Request('http://x', { method, body: JSON.stringify(body) });

describe('users routes — scope and privilege', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = mkSession();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
    tx.user.create.mockResolvedValue({ id: 'n', email: 'n@x.co', name: 'N', password: 'h' });
    tx.user.update.mockResolvedValue({ id: 'n', email: 'n@x.co', name: 'N', password: 'h' });
  });

  it('H4: refuses editing a user whose live role is in another tenant even if legacy org is in scope', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      target({ organisationId: 'campus-a', activeRole: 'CAMPUS_LEADER', userRoles: [{ role: 'OVERSIGHT_ADMIN', organisationId: 'other' }] }),
    );
    const res = await PUT(json('PUT', { phone: '024', email: 'evil@x.co', name: 'x' }), ctx);
    expect(res.status).toBe(403);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('H4: refuses an email change on an active account for a non-super admin', async () => {
    prismaMock.user.findUnique.mockImplementation(async (a: any) =>
      a.select?.password
        ? { id: 't', name: 'T', email: 'old@x.co', phone: '024', password: 'hash' }
        : target({ organisationId: 'acct-a', activeRole: 'CAMPUS_LEADER', userRoles: [{ role: 'CAMPUS_LEADER', organisationId: 'acct-a' }] }),
    );
    const res = await PUT(json('PUT', { phone: '024', email: 'new@x.co', name: 'T' }), ctx);
    expect(res.status).toBe(403);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('H6: null legacy org with no live roles fails closed on GET and PATCH', async () => {
    prismaMock.user.findUnique.mockResolvedValue(target());
    expect((await GET(new Request('http://x'), ctx)).status).toBe(403);
    expect((await PATCH(json('PATCH', { archived: true }), ctx)).status).toBe(403);
  });

  it('H6: null legacy org but a live role elsewhere is refused on archive', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      target({ userRoles: [{ role: 'CAMPUS_LEADER', organisationId: 'other' }] }),
    );
    expect((await PATCH(json('PATCH', { archived: true }), ctx)).status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('GET does not request audit logs for non-super readers', async () => {
    prismaMock.user.findUnique.mockImplementation(async (a: any) =>
      a.include ? { id: 't', password: 'h', userRoles: [] } : target({ userRoles: [{ role: 'CAMPUS_LEADER', organisationId: 'acct-a' }] }),
    );
    const res = await GET(new Request('http://x'), ctx);
    expect(res.status).toBe(200);
    const call = prismaMock.user.findUnique.mock.calls.find((c: any) => c[0].include)![0];
    expect(call.include.auditLogs).toBeUndefined();
  });

  it('H5: a campus admin cannot create a DENOMINATION_ADMIN; nothing is written', async () => {
    const res = await POST(
      json('POST', { name: 'X', email: 'x@y.co', phone: '024', roleOrganisationPairs: [{ role: 'DENOMINATION_ADMIN', organisationId: 'campus-a' }] }),
    );
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('H5: creates user and roles in one transaction with id/updatedAt supplied', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.organisation.findUnique.mockResolvedValue({ name: 'Acct' });
    const res = await POST(
      json('POST', { name: 'X', email: 'x@y.co', phone: '024', roleOrganisationPairs: [{ role: 'CAMPUS_LEADER', organisationId: 'acct-a' }] }),
    );
    expect(res.status).toBe(200);
    const rows = tx.userRole.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ role: 'CAMPUS_LEADER', organisationId: 'acct-a' });
    expect(rows[0].id).toBeTruthy();
    expect(rows[0].updatedAt).toBeInstanceOf(Date);
  });

  it('H6: ?available=true never relies on the legacy org alone', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const { GET: LIST } = await import('./route');
    await LIST(new Request('http://x/api/users?available=true'));
    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain('"organisationId":null');
    expect(JSON.stringify(where)).toContain('userRoles');
  });
});
