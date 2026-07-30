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

// Organisation hierarchy — STREAM deprecated; Campus → Account is one step
export const ORGANISATION_HIERARCHY: Record<string, number> = {
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
    STREAM: 3.5, // legacy only
    COUNCIL: 4,
};

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
