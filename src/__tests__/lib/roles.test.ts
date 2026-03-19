import { describe, it, expect } from 'vitest';
import {
    ROLE_HIERARCHY,
    DEPARTMENT_HIERARCHY,
    canManageUser,
    canAssignRole,
    getAssignableRoles,
    canManageDepartmentLevel,
    getDepartmentLevelForRole,
} from '@/lib/roles';

describe('ROLE_HIERARCHY', () => {
    it('assigns lower numbers to higher-privilege roles', () => {
        expect(ROLE_HIERARCHY.SUPERADMIN).toBeLessThan(ROLE_HIERARCHY.DENOMINATION_ADMIN);
        expect(ROLE_HIERARCHY.DENOMINATION_ADMIN).toBeLessThan(ROLE_HIERARCHY.OVERSIGHT_ADMIN);
        expect(ROLE_HIERARCHY.OVERSIGHT_ADMIN).toBeLessThan(ROLE_HIERARCHY.CAMPUS_ADMIN);
        expect(ROLE_HIERARCHY.CAMPUS_ADMIN).toBeLessThan(ROLE_HIERARCHY.STREAM_ADMIN);
        expect(ROLE_HIERARCHY.STREAM_ADMIN).toBeLessThan(ROLE_HIERARCHY.COUNCIL_ADMIN);
    });

    it('covers all 11 roles', () => {
        expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(11);
    });
});

describe('canManageUser', () => {
    it('allows SUPERADMIN to manage any role', () => {
        expect(canManageUser('SUPERADMIN', 'COUNCIL_LEADER')).toBe(true);
        expect(canManageUser('SUPERADMIN', 'DENOMINATION_ADMIN')).toBe(true);
    });

    it('allows admins to manage roles below them', () => {
        expect(canManageUser('CAMPUS_ADMIN', 'CAMPUS_LEADER')).toBe(true);
        expect(canManageUser('CAMPUS_ADMIN', 'COUNCIL_LEADER')).toBe(true);
    });

    it('prevents lower-privilege roles from managing higher ones', () => {
        expect(canManageUser('COUNCIL_LEADER', 'SUPERADMIN')).toBe(false);
        expect(canManageUser('CAMPUS_ADMIN', 'DENOMINATION_ADMIN')).toBe(false);
    });

    it('returns false for unknown roles', () => {
        expect(canManageUser('UNKNOWN_ROLE', 'COUNCIL_LEADER')).toBe(false);
        expect(canManageUser('SUPERADMIN', 'UNKNOWN_ROLE')).toBe(false);
    });
});

describe('canAssignRole', () => {
    it('allows assigning roles strictly below own level', () => {
        expect(canAssignRole('DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN')).toBe(true);
        expect(canAssignRole('CAMPUS_ADMIN', 'COUNCIL_LEADER')).toBe(true);
    });

    it('prevents assigning roles at or above own level', () => {
        expect(canAssignRole('CAMPUS_ADMIN', 'CAMPUS_ADMIN')).toBe(false);
        expect(canAssignRole('CAMPUS_ADMIN', 'DENOMINATION_ADMIN')).toBe(false);
    });

    it('prevents SUPERADMIN from assigning SUPERADMIN', () => {
        expect(canAssignRole('SUPERADMIN', 'SUPERADMIN')).toBe(false);
    });
});

describe('getAssignableRoles', () => {
    it('returns all roles below SUPERADMIN for SUPERADMIN', () => {
        const roles = getAssignableRoles('SUPERADMIN');
        expect(roles).not.toContain('SUPERADMIN');
        expect(roles).toContain('DENOMINATION_ADMIN');
        expect(roles).toContain('COUNCIL_LEADER');
    });

    it('returns only roles below CAMPUS_ADMIN', () => {
        const roles = getAssignableRoles('CAMPUS_ADMIN');
        expect(roles).not.toContain('SUPERADMIN');
        expect(roles).not.toContain('DENOMINATION_ADMIN');
        expect(roles).not.toContain('CAMPUS_ADMIN');
        expect(roles).toContain('CAMPUS_LEADER');
        expect(roles).toContain('COUNCIL_LEADER');
    });

    it('returns empty array for unknown role', () => {
        expect(getAssignableRoles('UNKNOWN')).toHaveLength(0);
    });
});

describe('canManageDepartmentLevel', () => {
    it('allows managing same or lower department levels', () => {
        expect(canManageDepartmentLevel('DENOMINATION', 'DENOMINATION')).toBe(true);
        expect(canManageDepartmentLevel('DENOMINATION', 'COUNCIL')).toBe(true);
        expect(canManageDepartmentLevel('CAMPUS', 'COUNCIL')).toBe(true);
    });

    it('prevents managing higher department levels', () => {
        expect(canManageDepartmentLevel('CAMPUS', 'DENOMINATION')).toBe(false);
        expect(canManageDepartmentLevel('COUNCIL', 'OVERSIGHT')).toBe(false);
    });
});

describe('getDepartmentLevelForRole', () => {
    it('maps admin roles to correct levels', () => {
        expect(getDepartmentLevelForRole('DENOMINATION_ADMIN')).toBe('DENOMINATION');
        expect(getDepartmentLevelForRole('OVERSIGHT_ADMIN')).toBe('OVERSIGHT');
        expect(getDepartmentLevelForRole('CAMPUS_ADMIN')).toBe('CAMPUS');
        expect(getDepartmentLevelForRole('STREAM_ADMIN')).toBe('STREAM');
        expect(getDepartmentLevelForRole('COUNCIL_ADMIN')).toBe('COUNCIL');
    });

    it('maps leader roles to correct levels', () => {
        expect(getDepartmentLevelForRole('CAMPUS_LEADER')).toBe('CAMPUS');
        expect(getDepartmentLevelForRole('COUNCIL_LEADER')).toBe('COUNCIL');
    });

    it('returns null for SUPERADMIN (no department level)', () => {
        expect(getDepartmentLevelForRole('SUPERADMIN')).toBeNull();
    });

    it('returns null for unknown role', () => {
        expect(getDepartmentLevelForRole('UNKNOWN')).toBeNull();
    });
});
