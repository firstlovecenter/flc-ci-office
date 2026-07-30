'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { canAdministerOrganisation } from '@/lib/roles';

/**
 * One place that answers "what may this user do?".
 *
 * The same role-string arrays were previously re-declared in the sidebar,
 * dashboard, ledger, approvals, users, reports, analytics and the transaction
 * form — eight copies drifting independently. A role added to one and missed in
 * another silently changes what someone can see, which is a correctness problem
 * rather than a tidiness one.
 *
 * Scope ("*which* churches?") is answered server-side by `hasOrganisationAccess`.
 * This only answers capability, and every gate here has a matching server check.
 */

export const LEADER_ROLES = [
    'DENOMINATION_LEADER',
    'OVERSIGHT_LEADER',
    'CAMPUS_LEADER',
    'STREAM_LEADER',
    'COUNCIL_LEADER',
] as const;

export const APPROVER_ROLES = [
    'SUPERADMIN',
    'DENOMINATION_ADMIN',
    'OVERSIGHT_ADMIN',
    'CAMPUS_ADMIN',
] as const;

/** Roles whose organisation has child churches. Campus is the lowest level. */
const HAS_CHILD_CHURCHES_PREFIX = ['DENOMINATION', 'OVERSIGHT'] as const;

export interface Permissions {
    role: string | null;
    roles: string[];
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isLeader: boolean;
    /** Holds a bank account directly rather than overseeing churches. */
    isAccountHolder: boolean;
    /** May create, edit or close churches and accounts. */
    canAdministerOrganisations: boolean;
    /** May approve or decline withdrawal requests. */
    canApprove: boolean;
    /** May create and edit users. */
    canManageUsers: boolean;
    /** Their organisation has churches beneath it — campuses do not. */
    canSeeChurches: boolean;
    /** May browse the accounts directory (account holders only use their own). */
    canSeeAccounts: boolean;
    canSeeAnalytics: boolean;
    /** Records entries directly rather than submitting them for approval. */
    recordsDirectly: boolean;
}

/**
 * The capability rules, as a pure function of the session's role claims.
 *
 * Separated from the hook so the matrix can be asserted directly without a
 * React renderer — see usePermissions.test.ts.
 */
export function computePermissions(rawRole?: string | null, rawRoles?: string[] | null): Permissions {
        const role = (rawRole || '').toUpperCase() || null;
        const roles = (rawRoles || []).map((r: string) => r.toUpperCase());

        const isSuperAdmin = role === 'SUPERADMIN' || roles.includes('SUPERADMIN');
        const isAdmin = !!role && role.endsWith('_ADMIN');
        const isLeader = !!role && (LEADER_ROLES as readonly string[]).includes(role);
        const isAccountHolder = role === 'COUNCIL_LEADER' || role === 'STREAM_LEADER';

        const canSeeChurches = isSuperAdmin
            || HAS_CHILD_CHURCHES_PREFIX.some(p => !!role && role.startsWith(p));

        return {
            role,
            roles,
            isSuperAdmin,
            isAdmin,
            isLeader,
            isAccountHolder,
            canAdministerOrganisations: canAdministerOrganisation(role),
            canApprove: !!role && (APPROVER_ROLES as readonly string[]).includes(role),
            canManageUsers: isAdmin || isSuperAdmin,
            canSeeChurches,
            // Account holders only ever use their own account.
            canSeeAccounts: isSuperAdmin || isAdmin || (isLeader && !isAccountHolder),
            canSeeAnalytics: isAdmin || isSuperAdmin
                || ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER'].includes(role || ''),
            recordsDirectly: isSuperAdmin,
        };
}

export function usePermissions(): Permissions {
    const { data: session } = useSession();
    const role = session?.user?.role;
    const roles = session?.user?.roles;
    return useMemo(() => computePermissions(role, roles), [role, roles]);
}
