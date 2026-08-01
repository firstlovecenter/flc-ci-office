// Role hierarchy - lower number = higher privilege
export const ROLE_HIERARCHY: Record<string, number> = {
    SUPERADMIN: 1,
    DENOMINATION_ADMIN: 2,
    OVERSIGHT_ADMIN: 3,
    CAMPUS_ADMIN: 4,
    STREAM_ADMIN: 5,
    COUNCIL_ADMIN: 6,
    DENOMINATION_LEADER: 7,
    OVERSIGHT_LEADER: 8,
    CAMPUS_LEADER: 9,
    STREAM_LEADER: 10,
    COUNCIL_LEADER: 11,
};

// Church hierarchy: HQ → Oversight → Campus (lowest org / church level).
// COUNCIL is a bank account under a Campus — not a church level. Kept in the
// map only so campus managers can manage attached accounts.
export const ORGANISATION_HIERARCHY: Record<string, number> = {
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
    STREAM: 3.5, // legacy only
    COUNCIL: 4, // bank account under campus — not an org unit
};

/**
 * Whether a role may create, edit, or close churches and bank accounts.
 *
 * Scope (*which* organisations) is a separate question answered by
 * `hasOrganisationAccess` — this only answers *whether* the role is allowed to
 * administer organisations at all. Both checks must pass.
 *
 * Deliberately matches the sidebar's existing `endsWith('_ADMIN')` test rather
 * than an explicit list, so legacy STREAM_ADMIN / COUNCIL_ADMIN holders are not
 * locked out. Every LEADER role is excluded, which is the point: leaders could
 * previously reassign their own organisation's leader and manager.
 */
export function canAdministerOrganisation(role?: string | null): boolean {
    if (!role) return false;
    return role === 'SUPERADMIN' || role.endsWith('_ADMIN');
}

/**
 * Whether a role may reopen a closed bank account.
 *
 * Deliberately narrower than `canAdministerOrganisation`. Campus managers open
 * accounts and close them, but reopening one is a review of that decision — it
 * restores a money-bearing account that someone deliberately retired — so it
 * sits with oversight and HQ. Scope still applies on top: the reopener must
 * control the campus the account hangs off.
 */
export function canReopenAccount(role?: string | null): boolean {
    if (!role) return false;
    return role === 'SUPERADMIN' || role === 'DENOMINATION_ADMIN' || role === 'OVERSIGHT_ADMIN';
}

/**
 * Check if an admin can manage (create/edit/delete) a user based on role hierarchy
 * @param adminRole - The role of the admin performing the action
 * @param targetRole - The role of the user being managed
 * @returns true if the admin can manage the user
 */
export function canManageUser(adminRole: string, targetRole: string): boolean {
    const adminLevel = ROLE_HIERARCHY[adminRole];
    const targetLevel = ROLE_HIERARCHY[targetRole];

    if (adminLevel === undefined || targetLevel === undefined) {
        return false;
    }

    // Admin must have equal or higher privilege (lower or equal number)
    return adminLevel <= targetLevel;
}

/**
 * Check if an admin can assign a specific role
 * @param adminRole - The role of the admin
 * @param roleToAssign - The role being assigned
 * @returns true if the admin can assign this role
 */
export function canAssignRole(adminRole: string, roleToAssign: string): boolean {
    const adminLevel = ROLE_HIERARCHY[adminRole];
    const roleLevel = ROLE_HIERARCHY[roleToAssign];

    if (adminLevel === undefined || roleLevel === undefined) {
        return false;
    }

    // Admin can only assign roles at their level or below (higher number)
    return adminLevel < roleLevel; // Strictly less than to prevent assigning same level
}

/**
 * Get all roles that an admin can assign
 * @param adminRole - The role of the admin
 * @returns Array of role names that can be assigned
 */
export function getAssignableRoles(adminRole: string): string[] {
    const adminLevel = ROLE_HIERARCHY[adminRole];
    
    if (adminLevel === undefined) {
        return [];
    }

    return Object.keys(ROLE_HIERARCHY).filter(role => {
        const roleLevel = ROLE_HIERARCHY[role];
        return roleLevel > adminLevel; // Can assign roles below their level
    });
}

/**
 * Check if a organisation is at or below another organisation in hierarchy
 * @param adminOrganisationLevel - The organisation level of the admin
 * @param targetOrganisationLevel - The organisation level being checked
 * @returns true if target is at or below admin level
 */
export function canManageOrganisationLevel(adminOrganisationLevel: string, targetOrganisationLevel: string): boolean {
    const adminLevel = ORGANISATION_HIERARCHY[adminOrganisationLevel];
    const targetLevel = ORGANISATION_HIERARCHY[targetOrganisationLevel];

    if (adminLevel === undefined || targetLevel === undefined) {
        return false;
    }

    // Target must be at admin's level or below (higher or equal number)
    return adminLevel <= targetLevel;
}

/**
 * Get the organisation level that corresponds to a role
 * @param role - The role name
 * @returns The organisation level string (e.g., 'CAMPUS', 'DENOMINATION') or null if role doesn't map to a organisation
 */
export function getOrganisationLevelForRole(role: string): string | null {
    // Map roles to their corresponding organisation levels
    const roleMapping: Record<string, string> = {
        DENOMINATION_ADMIN: 'DENOMINATION',
        DENOMINATION_LEADER: 'DENOMINATION',
        OVERSIGHT_ADMIN: 'OVERSIGHT',
        OVERSIGHT_LEADER: 'OVERSIGHT',
        CAMPUS_ADMIN: 'CAMPUS',
        CAMPUS_LEADER: 'CAMPUS',
        STREAM_ADMIN: 'STREAM',
        STREAM_LEADER: 'STREAM',
        COUNCIL_ADMIN: 'COUNCIL',
        COUNCIL_LEADER: 'COUNCIL',
    };

    return roleMapping[role] || null;
}
