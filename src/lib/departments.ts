import { prisma } from '@/lib/prisma';
import { DepartmentLevel, Role } from '@prisma/client';

/**
 * Map department level to the corresponding leader role
 */
export function getLeaderRoleForLevel(level: DepartmentLevel): Role {
    const levelToRole: Record<DepartmentLevel, Role> = {
        DENOMINATION: 'DENOMINATION_LEADER',
        OVERSIGHT: 'OVERSIGHT_LEADER',
        CAMPUS: 'CAMPUS_LEADER',
        STREAM: 'STREAM_LEADER',
        COUNCIL: 'COUNCIL_LEADER',
    };
    return levelToRole[level];
}

/**
 * Map department level to the corresponding admin role
 */
export function getAdminRoleForLevel(level: DepartmentLevel): Role | null {
    const levelToRole: Partial<Record<DepartmentLevel, Role>> = {
        DENOMINATION: 'DENOMINATION_ADMIN',
        OVERSIGHT: 'OVERSIGHT_ADMIN',
        CAMPUS: 'CAMPUS_ADMIN',
        // STREAM and COUNCIL don't have admin roles
    };
    return levelToRole[level] || null;
}

/**
 * Recursively fetches all descendant department IDs for a given department ID.
 * Includes the given department ID in the result.
 * Optimized to use a single query with CTE instead of N+1 queries.
 * Only includes active departments by default.
 */
export async function getDescendantDepartmentIds(departmentId: string, includeInactive: boolean = false): Promise<string[]> {
    // Use raw SQL with recursive CTE for much better performance
    // Only traverse active departments unless includeInactive is true
    if (includeInactive) {
        const result = await prisma.$queryRaw<Array<{ id: string }>>`
            WITH RECURSIVE dept_tree AS (
                SELECT id FROM "Department" WHERE id = ${departmentId}
                UNION ALL
                SELECT d.id FROM "Department" d
                INNER JOIN dept_tree dt ON d."parentId" = dt.id
            )
            SELECT id FROM dept_tree
        `;
        return result.map(row => row.id);
    } else {
        const result = await prisma.$queryRaw<Array<{ id: string }>>`
            WITH RECURSIVE dept_tree AS (
                SELECT id FROM "Department" WHERE id = ${departmentId} AND "isActive" = true
                UNION ALL
                SELECT d.id FROM "Department" d
                INNER JOIN dept_tree dt ON d."parentId" = dt.id
                WHERE d."isActive" = true
            )
            SELECT id FROM dept_tree
        `;
        return result.map(row => row.id);
    }
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
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
    STREAM: 4,
    COUNCIL: 5,
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
