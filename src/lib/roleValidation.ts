import { prisma } from '@/lib/prisma';

// The email that is locked as the only SUPERADMIN
const SUPERADMIN_EMAIL = 'skaduteye@gmail.com';

/**
 * Validates role assignment constraints:
 * - Only skaduteye@gmail.com can have SUPERADMIN role
 * - Only one DENOMINATION_ADMIN can exist globally
 * - Multiple users can have other admin roles for the same organisation
 */
export async function validateRoleAssignment(
    userId: string,
    roles: string[],
    organisationId?: string | null,
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
                activeRole: 'SUPERADMIN',
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

    // Check for DENOMINATION_ADMIN constraint
    if (roles.includes('DENOMINATION_ADMIN')) {
        const existingDenominationAdmin = await prisma.user.findFirst({
            where: {
                activeRole: 'DENOMINATION_ADMIN',
                id: { not: userId },
                archived: false,
            },
            select: { id: true, email: true, name: true },
        });

        if (existingDenominationAdmin) {
            return {
                valid: false,
                error: `There can only be one DENOMINATION_ADMIN. Current DENOMINATION_ADMIN: ${existingDenominationAdmin.name || existingDenominationAdmin.email}`,
            };
        }
    }

    // Multiple users CAN have the same organisation-level admin roles
    // No additional validation needed for:
    // OVERSIGHT_ADMIN, CAMPUS_ADMIN, etc.

    return { valid: true };
}

/**
 * Get all users with a specific role
 */
export async function getUsersByRole(role: string, organisationId?: string) {
    // Query users by activeRole or through userRoles relationship
    const where: any = {
        OR: [
            { activeRole: role },
            { userRoles: { some: { role } } },
        ],
        archived: false,
    };

    if (organisationId) {
        where.organisationId = organisationId;
    }

    return await prisma.user.findMany({
        where,
        include: { organisation: true,
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
    organisationId?: string | null
): Promise<{ canAssign: boolean; reason?: string }> {
    // For non-unique roles, always allow
    if (!['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(role)) {
        return { canAssign: true };
    }

    // For unique roles, check if one already exists
    const validation = await validateRoleAssignment(userId, [role], organisationId);

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
        'DENOMINATION_ADMIN',
        'DENOMINATION_LEADER',
        'OVERSIGHT_ADMIN',
        'OVERSIGHT_LEADER',
        'CAMPUS_ADMIN',
        'CAMPUS_LEADER',
        'STREAM_ADMIN',
        'STREAM_LEADER',
        'COUNCIL_ADMIN',
        'COUNCIL_LEADER',
    ];

    const stats = await Promise.all(
        roles.map(async (role) => {
            const count = await prisma.user.count({
                where: {
                    OR: [
                        { activeRole: role as any },
                        { userRoles: { some: { role: role as any } } },
                    ],
                    archived: false,
                },
            });

            return { role, count };
        })
    );

    return stats;
}
