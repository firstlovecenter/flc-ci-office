import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  userRole: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, getWorkerCtx: () => undefined }));

import { loadAuthClaimsFromDb, authOptions } from './auth';
import { syncLegacyUserColumns } from './user-claims';

const base = {
  id: 'u1', email: 'a@b.co', name: 'A', image: null, archived: false, passwordChangedAt: null,
  organisationId: null, organisation: null, activeUserRole: null, activeUserRoleId: null,
};
const row = (id: string, role: string, org = 'o1') => ({ id, role, organisationId: org, organisation: { level: 'CAMPUS', name: 'C' } });

describe('loadAuthClaimsFromDb (M5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when the only DENOMINATION_ADMIN row is gone, even if the legacy column still says so', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...base, activeRole: 'DENOMINATION_ADMIN', userRoles: [] });
    await expect(loadAuthClaimsFromDb('u1')).rejects.toThrow();
  });

  it('derives CAMPUS_LEADER from the remaining row, ignoring a stale legacy admin role', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...base, activeRole: 'DENOMINATION_ADMIN', userRoles: [row('r1', 'CAMPUS_LEADER')],
    });
    const claims = await loadAuthClaimsFromDb('u1');
    expect(claims.role).toBe('CAMPUS_LEADER');
    expect(claims.roles).toEqual(['CAMPUS_LEADER']);
    expect(claims.organisationId).toBe('o1');
  });

  it('enforces the SUPERADMIN pin at claims loading', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...base, email: 'imposter@x.co', activeRole: 'SUPERADMIN', userRoles: [] });
    await expect(loadAuthClaimsFromDb('u1')).rejects.toThrow();
    prismaMock.user.findUnique.mockResolvedValue({ ...base, email: 'skaduteye@gmail.com', activeRole: 'SUPERADMIN', userRoles: [] });
    expect((await loadAuthClaimsFromDb('u1')).role).toBe('SUPERADMIN');
  });

  it('carries passwordChangedAt so older sessions can be rejected', async () => {
    const when = new Date('2026-01-01');
    prismaMock.user.findUnique.mockResolvedValue({
      ...base, activeRole: 'CAMPUS_LEADER', passwordChangedAt: when, userRoles: [row('r1', 'CAMPUS_LEADER')],
    });
    expect((await loadAuthClaimsFromDb('u1')).passwordChangedAt).toBe(when.getTime());
  });
});

describe('jwt callback', () => {
  beforeEach(() => vi.clearAllMocks());
  const jwt = authOptions.callbacks!.jwt!;

  it('rejects a session before the last password change', async () => {
    const when = Date.now();
    prismaMock.user.findUnique.mockResolvedValue({
      ...base, activeRole: 'CAMPUS_LEADER', passwordChangedAt: new Date(when), userRoles: [row('r1', 'CAMPUS_LEADER')],
    });
    const out: any = await jwt({ token: { id: 'u1', email: 'a@b.co', loginAt: when - 60_000 } as any, user: undefined as any, trigger: undefined, session: undefined } as any);
    expect(out.expired).toBe(true);
  });

  it('ignores client-driven impersonation from anyone but the pinned super admin', async () => {
    const token: any = { id: 'u1', email: 'a@b.co', role: 'CAMPUS_ADMIN', loginAt: Date.now() };
    const out: any = await jwt({ token, trigger: 'update', session: { impersonateUserId: 'victim' } } as any);
    expect(out.isImpersonating).toBeUndefined();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses nested impersonation and self-impersonation, and audits a valid start under the real admin', async () => {
    const admin = { id: 'sa', email: 'skaduteye@gmail.com', role: 'SUPERADMIN', loginAt: Date.now() };
    let out: any = await jwt({ token: { ...admin, isImpersonating: true }, trigger: 'update', session: { impersonateUserId: 'x' } } as any);
    expect(out.originalAdminId).toBeUndefined();
    out = await jwt({ token: { ...admin }, trigger: 'update', session: { impersonateUserId: 'sa' } } as any);
    expect(out.isImpersonating).toBeUndefined();

    prismaMock.user.findUnique.mockResolvedValue({ ...base, id: 'tgt', activeRole: 'CAMPUS_LEADER', userRoles: [row('r1', 'CAMPUS_LEADER')] });
    out = await jwt({ token: { ...admin }, trigger: 'update', session: { impersonateUserId: 'tgt' } } as any);
    expect(out.isImpersonating).toBe(true);
    expect(out.originalAdminId).toBe('sa');
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.userId).toBe('sa');
  });
});

describe('syncLegacyUserColumns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-points to a remaining role instead of nulling', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ activeRole: 'DENOMINATION_ADMIN', activeUserRoleId: 'gone' });
    prismaMock.userRole.findMany.mockResolvedValue([{ id: 'r2', role: 'CAMPUS_LEADER', organisationId: 'o2' }]);
    await syncLegacyUserColumns(prismaMock as any, 'u1');
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ activeUserRoleId: 'r2', activeRole: 'CAMPUS_LEADER', organisationId: 'o2' });
  });

  it('clears everything when no rows remain, but leaves a pinned SUPERADMIN alone', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue({ activeRole: 'DENOMINATION_ADMIN', activeUserRoleId: 'gone' });
    await syncLegacyUserColumns(prismaMock as any, 'u1');
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ activeUserRoleId: null, activeRole: null, organisationId: null });
    prismaMock.user.update.mockClear();
    prismaMock.user.findUnique.mockResolvedValue({ activeRole: 'SUPERADMIN', activeUserRoleId: null });
    await syncLegacyUserColumns(prismaMock as any, 'u1');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
