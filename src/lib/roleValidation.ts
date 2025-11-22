import { prisma } from '@/lib/prisma';

// The email that is locked as the only SUPERADMIN
const SUPERADMIN_EMAIL = 'skaduteye@gmail.com';

/**
 * Validates role assignment constraints:
 * - Only skaduteye@gmail.com can have SUPERADMIN role
 * - Only one GLOBAL_ADMIN can exist globally
 * - Multiple users can have other admin roles for the same department
 */
export async function validateRoleAssignment(
    userId: string,
    roles: string[],
    departmentId?: string | null,
    userEmail?: string
): Promise<{ valid: boolean; error?: string }> {
    // Check for SUPERADMIN constraint - only skaduteye@gmail.com can have it
    if (roles.includes('SUPERADMIN')) {
        // If we have the user's email, check it directly
        if (userEmail && userEmail !== SUPERADMIN_EMAIL) {
            return {
                valid: false,
                error: `Only ${SUPERADMIN_EMAIL} can have the SUPERADMIN role.`,
            };
        }
        
        // If we don't have email, fetch the user and check
        if (!userEmail && userId !== 'new-user') {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });
            
            if (user && user.email !== SUPERADMIN_EMAIL) {
                return {
                    valid: false,
                    error: `Only ${SUPERADMIN_EMAIL} can have the SUPERADMIN role.`,
                };
            }
        }
        
        // Check if someone else already has SUPERADMIN
        const existingSuperAdmin = await prisma.user.findFirst({
            where: {
                roles: { has: 'SUPERADMIN' },
                id: { not: userId },
                archived: false,
            },
            select: { id: true, email: true, name: true },
        });

        if (existingSuperAdmin && existingSuperAdmin.email !== SUPERADMIN_EMAIL) {
            return {
                valid: false,
                error: `Only ${SUPERADMIN_EMAIL} can have the SUPERADMIN role. Current holder: ${existingSuperAdmin.email}`,
            };
        }
    }

    // Check for GLOBAL_ADMIN constraint
    if (roles.includes('GLOBAL_ADMIN')) {
        const existingGlobalAdmin = await prisma.user.findFirst({
            where: {
                roles: { has: 'GLOBAL_ADMIN' },
                id: { not: userId },
                archived: false,
            },
            select: { id: true, email: true, name: true },
        });

        if (existingGlobalAdmin) {
            return {
                valid: false,
                error: `There can only be one GLOBAL_ADMIN. Current GLOBAL_ADMIN: ${existingGlobalAdmin.name || existingGlobalAdmin.email}`,
            };
        }
    }

    // Multiple users CAN have the same department-level admin roles
    // No additional validation needed for:
    // INTERNATIONAL_ADMIN, NATIONAL_ADMIN, REGIONAL_ADMIN, CAMPUS_ADMIN, etc.

    return { valid: true };
}

/**
 * Get all users with a specific role
 */
export async function getUsersByRole(role: string, departmentId?: string) {
    const where: any = {
        roles: { has: role },
        archived: false,
    };

    if (departmentId) {
        where.departmentId = departmentId;
    }

    return await prisma.user.findMany({
        where,
        include: {
            department: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

/**
 * Check if a user can be assigned a specific role
 */
export async function canAssignRole(
    userId: string,
    role: string,
    departmentId?: string | null
): Promise<{ canAssign: boolean; reason?: string }> {
    // For non-unique roles, always allow
    if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(role)) {
        return { canAssign: true };
    }

    // For unique roles, check if one already exists
    const validation = await validateRoleAssignment(userId, [role], departmentId);

    if (!validation.valid) {
        return {
            canAssign: false,
            reason: validation.error,
        };
    }

    return { canAssign: true };
}

/**
 * Get role assignment statistics
 */
export async function getRoleStats() {
    const roles = [
        'SUPERADMIN',
        'GLOBAL_ADMIN',
        'GLOBAL_LEADER',
        'INTERNATIONAL_ADMIN',
        'INTERNATIONAL_LEADER',
        'NATIONAL_ADMIN',
        'NATIONAL_LEADER',
        'REGIONAL_ADMIN',
        'REGIONAL_LEADER',
        'CAMPUS_ADMIN',
        'CAMPUS_LEADER',
        'STREAM_LEADER',
        'COUNCIL_LEADER',
    ];

    const stats = await Promise.all(
        roles.map(async (role) => {
            const count = await prisma.user.count({
                where: {
                    roles: { has: role as any },
                    archived: false,
                },
            });

            return { role, count };
        })
    );

    return stats;
}
