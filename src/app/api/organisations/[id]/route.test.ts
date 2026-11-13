import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({ current: null as any }));
const prismaMock = vi.hoisted(() => ({
  organisation: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  userRole: { update: vi.fn(), delete: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const orgLib = vi.hoisted(() => ({ descendants: [] as string[] }));

vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/password-reset', () => ({ sendSetupLinkEmail: vi.fn() }));
vi.mock('@/lib/organisations', async (orig) => {
  const actual = await orig<typeof import('@/lib/organisations')>();
  return {
    ...actual,
    getDescendantOrganisationIds: async () => orgLib.descendants,
    hasOrganisationAccess: async (u: { organisationId?: string | null }, id: string) =>
      u.organisationId === id || orgLib.descendants.includes(id),
  };
});

import { PUT } from './route';

const CAMPUS = 'campus-a';
const callerSession = (role = 'CAMPUS_ADMIN', orgId = CAMPUS) => ({
  user: { id: 'me', role, organisationId: orgId, activeUserRole: { organisationId: orgId } },
});

const orgRow = (over: Record<string, unknown> = {}) => ({
  id: CAMPUS,
  name: 'Campus A',
  level: 'CAMPUS',
  parentId: 'oversight-1',
  accountType: null,
  isActive: true,
  userRoles: [{ id: 'ur-admin', userId: 'me', role: 'CAMPUS_ADMIN', user: { name: 'Me' } }],
  ...over,
});

const put = (id: string, body: unknown) =>
  PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe('PUT /api/organisations/[id] privileged-change guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = callerSession();
    orgLib.descendants = [CAMPUS, 'child-acct'];
    prismaMock.organisation.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === CAMPUS) return orgRow();
      if (where.id === 'oversight-1') return { level: 'OVERSIGHT', isActive: true };
      if (where.id === 'child-acct')
        return orgRow({ id: 'child-acct', level: 'COUNCIL', parentId: CAMPUS, accountType: 'OPERATING', userRoles: [] });
      return null;
    });
    prismaMock.organisation.update.mockResolvedValue({ id: CAMPUS });
  });

  it('403s a campus admin promoting their own church to DENOMINATION with self as admin', async () => {
    const res = await put(CAMPUS, { name: 'Campus A', level: 'DENOMINATION', parentId: null, adminId: 'me' });
    expect(res.status).toBe(403);
    expect(prismaMock.organisation.update).not.toHaveBeenCalled();
    expect(prismaMock.userRole.update).not.toHaveBeenCalled();
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it('allows an unchanged level/parent/admin resend (ordinary rename)', async () => {
    const res = await put(CAMPUS, {
      name: 'Campus A renamed',
      level: 'CAMPUS',
      parentId: 'oversight-1',
      adminId: 'me',
      leaderId: undefined,
    });
    expect(res.status).toBe(200);
    expect(prismaMock.organisation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it('403s reparenting under a church outside the caller’s subtree (M2)', async () => {
    session.current = callerSession('OVERSIGHT_ADMIN', 'oversight-1');
    orgLib.descendants = ['oversight-1', CAMPUS];
    const res = await put(CAMPUS, { name: 'Campus A', level: 'CAMPUS', parentId: 'foreign-oversight' });
    expect(res.status).toBe(403);
    expect(prismaMock.organisation.update).not.toHaveBeenCalled();
  });

  it('refuses to reparent the caller’s own active church', async () => {
    const res = await put(CAMPUS, { name: 'Campus A', level: 'CAMPUS', parentId: 'child-acct' });
    expect(res.status).toBe(403);
  });

  it('rejects granting an admin role the caller may not assign', async () => {
    const res = await put(CAMPUS, { name: 'Campus A', level: 'CAMPUS', parentId: 'oversight-1', adminId: 'someone' });
    expect(res.status).toBe(403);
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it('rejects a new leader who belongs to another tenant', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'stranger', archived: false, organisationId: 'other-campus', activeRole: 'CAMPUS_LEADER',
      userRoles: [{ role: 'CAMPUS_LEADER', organisationId: 'other-campus' }],
    });
    const res = await put(CAMPUS, { name: 'Campus A', leaderId: 'stranger' });
    expect(res.status).toBe(403);
    expect(prismaMock.userRole.create).not.toHaveBeenCalled();
  });

  it('rejects an archived new leader', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'gone', archived: true, organisationId: null, activeRole: null, userRoles: [],
    });
    const res = await put(CAMPUS, { name: 'Campus A', leaderId: 'gone' });
    expect(res.status).toBe(400);
  });

  it('lets a super admin change level', async () => {
    session.current = { user: { id: 'sa', role: 'SUPERADMIN', organisationId: null } };
    prismaMock.organisation.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === CAMPUS) return orgRow({ userRoles: [] });
      return { level: 'DENOMINATION', isActive: true };
    });
    const res = await put(CAMPUS, { name: 'Campus A', level: 'OVERSIGHT', parentId: 'hq' });
    expect(res.status).toBe(200);
  });
});
