import { prisma } from '@/lib/prisma';
import { DepartmentLevel } from '@prisma/client';

/**
 * Recursively fetches all descendant department IDs for a given department ID.
 * Includes the given department ID in the result.
 */
export async function getDescendantDepartmentIds(departmentId: string): Promise<string[]> {
    // Start with the current department
    const allIds = [departmentId];

    // Get immediate children
    const children = await prisma.department.findMany({
        where: { parentId: departmentId },
        select: { id: true }
    });

    for (const child of children) {
        const descendantIds = await getDescendantDepartmentIds(child.id);
        allIds.push(...descendantIds);
    }

    return allIds;
}

/**
 * Checks if a user has permission to access a target department.
 * Returns true if the user is a SuperAdmin or if the target department is
 * the user's department or one of its descendants.
 */
export async function hasDepartmentAccess(user: { role: string, departmentId?: string | null }, targetDepartmentId: string): Promise<boolean> {
    if (user.role === 'SUPERADMIN') {
        return true;
    }

    if (!user.departmentId) {
        return false;
    }

    // If the user is in the target department, they have access
    if (user.departmentId === targetDepartmentId) {
        return true;
    }

    // Check if target is a descendant
    const descendantIds = await getDescendantDepartmentIds(user.departmentId);
    return descendantIds.includes(targetDepartmentId);
}

/**
 * Department hierarchy map
 */
const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    GLOBAL: 1,
    INTERNATIONAL: 2,
    NATIONAL: 3,
    REGIONAL: 4,
    CAMPUS: 5,
    STREAM: 6,
    COUNCIL: 7,
};

/**
 * Get allowed department levels that a user with a specific role can create
 */
export function getAllowedDepartmentLevels(userRole: string, userDepartmentLevel?: DepartmentLevel): DepartmentLevel[] {
    // Superadmin can create any level
    if (userRole === 'SUPERADMIN') {
        return Object.keys(DEPARTMENT_HIERARCHY) as DepartmentLevel[];
    }

    // If no department level, cannot create departments
    if (!userDepartmentLevel) {
        return [];
    }

    const currentLevelRank = DEPARTMENT_HIERARCHY[userDepartmentLevel];
    const allowedLevels: DepartmentLevel[] = [];

    // Admins can create departments BELOW their own level (not at their own level)
    if (userRole.endsWith('_ADMIN')) {
        for (const [level, rank] of Object.entries(DEPARTMENT_HIERARCHY)) {
            if (rank > currentLevelRank) {
                allowedLevels.push(level as DepartmentLevel);
            }
        }
    }

    return allowedLevels;
}

/**
 * Check if a user can create a department at a specific level
 */
export function canCreateDepartmentLevel(
    userRole: string,
    userDepartmentLevel: DepartmentLevel | undefined,
    targetLevel: DepartmentLevel
): boolean {
    const allowedLevels = getAllowedDepartmentLevels(userRole, userDepartmentLevel);
    return allowedLevels.includes(targetLevel);
}
