/**
 * Capability matrix for every role in the system.
 *
 * The point of these is exhaustiveness: the eight previous copies of the role
 * arrays drifted precisely because nothing asserted them side by side.
 */
import { describe, it, expect } from 'vitest';
import { computePermissions } from './usePermissions';

const p = (role: string | null) => computePermissions(role, role ? [role] : []);

const ALL_ROLES = [
    'SUPERADMIN',
    'DENOMINATION_ADMIN', 'DENOMINATION_LEADER',
    'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER',
    'CAMPUS_ADMIN', 'CAMPUS_LEADER',
    'STREAM_ADMIN', 'STREAM_LEADER',
    'COUNCIL_ADMIN', 'COUNCIL_LEADER',
];

describe('capability matrix', () => {
    it('gives SUPERADMIN everything', () => {
        const s = p('SUPERADMIN');
        expect(s.isSuperAdmin).toBe(true);
        expect(s.canApprove).toBe(true);
        expect(s.canManageUsers).toBe(true);
        expect(s.canAdministerOrganisations).toBe(true);
        expect(s.canSeeChurches).toBe(true);
        expect(s.canSeeAccounts).toBe(true);
        expect(s.recordsDirectly).toBe(true);
    });

    it('lets CAMPUS_ADMIN manage but not browse churches — campus is the lowest level', () => {
        const s = p('CAMPUS_ADMIN');
        expect(s.isAdmin).toBe(true);
        expect(s.canApprove).toBe(true);
        expect(s.canManageUsers).toBe(true);
        expect(s.canAdministerOrganisations).toBe(true);
        expect(s.canSeeAccounts).toBe(true);
        expect(s.canSeeChurches).toBe(false);
        expect(s.recordsDirectly).toBe(false);
    });

    it('gives oversight and HQ roles the churches directory', () => {
        for (const r of ['OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER', 'DENOMINATION_ADMIN', 'DENOMINATION_LEADER']) {
            expect(p(r).canSeeChurches, r).toBe(true);
        }
    });

    it('denies every leader the admin capabilities', () => {
        for (const r of ALL_ROLES.filter(x => x.endsWith('_LEADER'))) {
            const s = p(r);
            expect(s.isLeader, r).toBe(true);
            expect(s.canApprove, r).toBe(false);
            expect(s.canManageUsers, r).toBe(false);
            expect(s.canAdministerOrganisations, r).toBe(false);
        }
    });

    it('treats only COUNCIL_LEADER and STREAM_LEADER as account holders', () => {
        for (const r of ALL_ROLES) {
            const expected = r === 'COUNCIL_LEADER' || r === 'STREAM_LEADER';
            expect(p(r).isAccountHolder, r).toBe(expected);
        }
    });

    it('hides the accounts directory from account holders only', () => {
        expect(p('COUNCIL_LEADER').canSeeAccounts).toBe(false);
        expect(p('STREAM_LEADER').canSeeAccounts).toBe(false);
        for (const r of ['CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER']) {
            expect(p(r).canSeeAccounts, r).toBe(true);
        }
    });

    it('grants approval to exactly the four approver roles', () => {
        const approvers = ALL_ROLES.filter(r => p(r).canApprove);
        expect(approvers.sort()).toEqual(
            ['CAMPUS_ADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'SUPERADMIN'].sort()
        );
    });

    it('lets only SUPERADMIN record without approval', () => {
        const direct = ALL_ROLES.filter(r => p(r).recordsDirectly);
        expect(direct).toEqual(['SUPERADMIN']);
    });

    it('denies everything when signed out', () => {
        const s = p(null);
        expect(s.role).toBeNull();
        expect(s.canApprove).toBe(false);
        expect(s.canManageUsers).toBe(false);
        expect(s.canAdministerOrganisations).toBe(false);
        expect(s.canSeeAccounts).toBe(false);
        expect(s.canSeeChurches).toBe(false);
        expect(s.recordsDirectly).toBe(false);
    });

    it('is case-insensitive about the incoming claim', () => {
        expect(computePermissions('campus_admin', []).canApprove).toBe(true);
    });

    it('honours SUPERADMIN arriving via the roles array', () => {
        expect(computePermissions('CAMPUS_LEADER', ['SUPERADMIN']).isSuperAdmin).toBe(true);
    });
});
