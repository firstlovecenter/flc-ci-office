/**
 * Characterisation tests for role gating.
 *
 * `canAdministerOrganisation` is the gate on PUT /api/organisations/[id] and the
 * close endpoints — the one that previously let any leader rename their own
 * church and reassign its leader. These assertions pin that shut.
 */
import { describe, it, expect } from 'vitest';
import { canAdministerOrganisation, canManageUser, canAssignRole, ROLE_HIERARCHY } from './roles';

const ADMIN_ROLES = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
const LEADER_ROLES = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];

describe('canAdministerOrganisation', () => {
    it('admits every admin role and superadmin', () => {
        for (const role of ADMIN_ROLES) {
            expect(canAdministerOrganisation(role), role).toBe(true);
        }
    });

    it('refuses every leader role', () => {
        // The privilege-escalation fix: leaders must never edit or close an org.
        for (const role of LEADER_ROLES) {
            expect(canAdministerOrganisation(role), role).toBe(false);
        }
    });

    it('refuses absent or unknown roles', () => {
        for (const v of [null, undefined, '', 'NOT_A_ROLE', 'ADMIN']) {
            expect(canAdministerOrganisation(v as string)).toBe(false);
        }
    });

    it('covers every role in the hierarchy without gaps', () => {
        for (const role of Object.keys(ROLE_HIERARCHY)) {
            const expected = role === 'SUPERADMIN' || role.endsWith('_ADMIN');
            expect(canAdministerOrganisation(role), role).toBe(expected);
        }
    });
});

describe('role hierarchy', () => {
    it('ranks admins above leaders at every level', () => {
        expect(ROLE_HIERARCHY.SUPERADMIN).toBeLessThan(ROLE_HIERARCHY.DENOMINATION_ADMIN);
        expect(ROLE_HIERARCHY.DENOMINATION_ADMIN).toBeLessThan(ROLE_HIERARCHY.OVERSIGHT_ADMIN);
        expect(ROLE_HIERARCHY.OVERSIGHT_ADMIN).toBeLessThan(ROLE_HIERARCHY.CAMPUS_ADMIN);
        expect(ROLE_HIERARCHY.CAMPUS_ADMIN).toBeLessThan(ROLE_HIERARCHY.DENOMINATION_LEADER);
    });

    it('lets a higher admin manage a lower role but not the reverse', () => {
        expect(canManageUser('OVERSIGHT_ADMIN', 'CAMPUS_LEADER')).toBe(true);
        expect(canManageUser('CAMPUS_ADMIN', 'OVERSIGHT_ADMIN')).toBe(false);
    });

    it('refuses to let a role assign its own level', () => {
        expect(canAssignRole('CAMPUS_ADMIN', 'CAMPUS_ADMIN')).toBe(false);
        expect(canAssignRole('CAMPUS_ADMIN', 'CAMPUS_LEADER')).toBe(true);
    });
});
