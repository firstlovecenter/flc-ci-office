import { prisma } from '@/lib/prisma';
import { OrganisationLevel, Role } from '@prisma/client';
import { getCreatableLevels, ORG_UNIT_HIERARCHY, isOrgUnit } from '@/lib/org-model';

/**
 * Map organisation level to the corresponding leader role
 */
export function getLeaderRoleForLevel(level: OrganisationLevel): Role {
    const levelToRole: Record<OrganisationLevel, Role> = {
        DENOMINATION: 'DENOMINATION_LEADER',
        OVERSIGHT: 'OVERSIGHT_LEADER',
        CAMPUS: 'CAMPUS_LEADER',
        STREAM: 'STREAM_LEADER',
        COUNCIL: 'COUNCIL_LEADER',
    };
    return levelToRole[level];
}

/**
 * Map organisation level to the corresponding admin role
 */
export function getAdminRoleForLevel(level: OrganisationLevel): Role | null {
    const levelToRole: Partial<Record<OrganisationLevel, Role>> = {
        DENOMINATION: 'DENOMINATION_ADMIN',
        OVERSIGHT: 'OVERSIGHT_ADMIN',
        CAMPUS: 'CAMPUS_ADMIN',
        STREAM: 'STREAM_ADMIN',
        COUNCIL: 'COUNCIL_ADMIN',
    };
    return levelToRole[level] || null;
}

/**
 * Recursively fetches all descendant organisation IDs for a given organisation ID.
 * Includes the given organisation ID in the result.
 */
export async function getDescendantOrganisationIds(organisationId: string, includeInactive: boolean = false): Promise<string[]> {
    if (includeInactive) {
        const result = await prisma.$queryRaw<Array<{ id: string }>>`
            WITH RECURSIVE dept_tree AS (
                SELECT id FROM "Organisation" WHERE id = ${organisationId}
                UNION ALL
                SELECT d.id FROM "Organisation" d
                INNER JOIN dept_tree dt ON d."parentId" = dt.id
            )
            SELECT id FROM dept_tree
        `;
        return result.map(row => row.id);
    } else {
        const result = await prisma.$queryRaw<Array<{ id: string }>>`
            WITH RECURSIVE dept_tree AS (
                SELECT id FROM "Organisation" WHERE id = ${organisationId} AND "isActive" = true
                UNION ALL
                SELECT d.id FROM "Organisation" d
                INNER JOIN dept_tree dt ON d."parentId" = dt.id
                WHERE d."isActive" = true
            )
            SELECT id FROM dept_tree
        `;
        return result.map(row => row.id);
    }
}

export async function hasOrganisationAccess(user: { role: string, organisationId?: string | null }, targetOrganisationId: string): Promise<boolean> {
    if (user.role === 'SUPERADMIN') {
        return true;
    }

    if (!user.organisationId) {
        return false;
    }

    if (user.organisationId === targetOrganisationId) {
        return true;
    }

    const descendantIds = await getDescendantOrganisationIds(user.organisationId);
    return descendantIds.includes(targetOrganisationId);
}

/** Allowed organisation-unit levels (HQ / Oversight / Campus) a user can create. */
export function getAllowedOrganisationLevels(userRole: string, userOrganisationLevel?: OrganisationLevel): OrganisationLevel[] {
    const creatable = getCreatableLevels();

    if (userRole === 'SUPERADMIN') {
        return creatable;
    }

    if (!userOrganisationLevel || !isOrgUnit(userOrganisationLevel)) {
        return [];
    }

    const currentLevelRank = ORG_UNIT_HIERARCHY[userOrganisationLevel as keyof typeof ORG_UNIT_HIERARCHY];
    if (currentLevelRank === undefined) {
        return [];
    }

    const allowedLevels: OrganisationLevel[] = [];

    if (userRole.endsWith('_ADMIN')) {
        for (const level of creatable) {
            const rank = ORG_UNIT_HIERARCHY[level as keyof typeof ORG_UNIT_HIERARCHY];
            if (rank > currentLevelRank) {
                allowedLevels.push(level);
            }
        }
    }

    return allowedLevels;
}

export function canCreateOrganisationLevel(
    userRole: string,
    userOrganisationLevel: OrganisationLevel | undefined,
    targetLevel: OrganisationLevel
): boolean {
    if (targetLevel === 'COUNCIL') return false;
    const allowedLevels = getAllowedOrganisationLevels(userRole, userOrganisationLevel);
    return allowedLevels.includes(targetLevel);
}

/** Campus (and above) managers can open bank accounts under a campus. */
export function canCreateAccount(
    userRole: string,
    userOrganisationLevel?: OrganisationLevel,
): boolean {
    if (userRole === 'SUPERADMIN') return true;
    if (!userRole.endsWith('_ADMIN')) return false;
    if (!userOrganisationLevel) return false;
    return isOrgUnit(userOrganisationLevel);
}
