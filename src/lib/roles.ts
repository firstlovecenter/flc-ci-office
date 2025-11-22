// Role hierarchy - lower number = higher privilege
export const ROLE_HIERARCHY: Record<string, number> = {
    SUPERADMIN: 1,
    GLOBAL_ADMIN: 2,
    INTERNATIONAL_ADMIN: 3,
    NATIONAL_ADMIN: 4,
    REGIONAL_ADMIN: 5,
    CAMPUS_ADMIN: 6,
    STREAM_ADMIN: 7,
    COUNCIL_ADMIN: 8,
    GLOBAL_LEADER: 9,
    INTERNATIONAL_LEADER: 10,
    NATIONAL_LEADER: 11,
    REGIONAL_LEADER: 12,
    CAMPUS_LEADER: 13,
    STREAM_LEADER: 14,
    COUNCIL_LEADER: 15,
};

// Department hierarchy
export const DEPARTMENT_HIERARCHY: Record<string, number> = {
    GLOBAL: 1,
    INTERNATIONAL: 2,
    NATIONAL: 3,
    REGIONAL: 4,
    CAMPUS: 5,
    STREAM: 6,
    COUNCIL: 7,
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
 * Check if a department is at or below another department in hierarchy
 * @param adminDepartmentLevel - The department level of the admin
 * @param targetDepartmentLevel - The department level being checked
 * @returns true if target is at or below admin level
 */
export function canManageDepartmentLevel(adminDepartmentLevel: string, targetDepartmentLevel: string): boolean {
    const adminLevel = DEPARTMENT_HIERARCHY[adminDepartmentLevel];
    const targetLevel = DEPARTMENT_HIERARCHY[targetDepartmentLevel];

    if (adminLevel === undefined || targetLevel === undefined) {
        return false;
    }

    // Target must be at admin's level or below (higher or equal number)
    return adminLevel <= targetLevel;
}

/**
 * Get the department level that corresponds to a role
 * @param role - The role name
 * @returns The department level string (e.g., 'CAMPUS', 'NATIONAL') or null if role doesn't map to a department
 */
export function getDepartmentLevelForRole(role: string): string | null {
    // Map roles to their corresponding department levels
    const roleMapping: Record<string, string> = {
        GLOBAL_ADMIN: 'GLOBAL',
        GLOBAL_LEADER: 'GLOBAL',
        INTERNATIONAL_ADMIN: 'INTERNATIONAL',
        INTERNATIONAL_LEADER: 'INTERNATIONAL',
        NATIONAL_ADMIN: 'NATIONAL',
        NATIONAL_LEADER: 'NATIONAL',
        REGIONAL_ADMIN: 'REGIONAL',
        REGIONAL_LEADER: 'REGIONAL',
        CAMPUS_ADMIN: 'CAMPUS',
        CAMPUS_LEADER: 'CAMPUS',
        STREAM_ADMIN: 'STREAM',
        STREAM_LEADER: 'STREAM',
        COUNCIL_ADMIN: 'COUNCIL',
        COUNCIL_LEADER: 'COUNCIL',
    };

    return roleMapping[role] || null;
}
