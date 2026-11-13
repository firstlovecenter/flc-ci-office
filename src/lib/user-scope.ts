import { prisma } from '@/lib/prisma';
import { getDescendantOrganisationIds } from '@/lib/organisations';
import { ROLE_HIERARCHY, canManageUser } from '@/lib/roles';

/**
 * Tenant-scope helpers for acting on *other users*.
 *
 * A user's scope is derived from their live UserRole rows plus the legacy
 * `organisationId` column. The legacy column alone is never trusted: it can be
 * null for users who still hold live roles elsewhere, and a null must not read
 * as "no restriction". An empty scope fails closed for everyone but SUPERADMIN.
 */

export interface ScopeCaller {
    id?: string;
    role: string;
    /** The caller's active organisation (active UserRole org, else legacy). */
    organisationId?: string | null;
}

export interface TargetScope {
    id: string;
    archived: boolean;
    /** Every organisation the user holds a live role in, plus the legacy org if set. */
    organisationIds: string[];
    /** Every role the user holds (live rows plus the legacy active role). */
    roles: string[];
    /** Highest-privilege role across all of the above, or null when none. */
    highestRole: string | null;
}

export type ScopeDecision = { ok: true } | { ok: false; status: number; error: string };

export function highestRoleOf(roles: Array<string | null | undefined>): string | null {
    let best: string | null = null;
    for (const r of roles) {
        if (!r || ROLE_HIERARCHY[r] === undefined) continue;
        if (best === null || ROLE_HIERARCHY[r] < ROLE_HIERARCHY[best]) best = r;
    }
    return best;
}

export function callerOrganisationId(session: {
    user: { organisationId?: string | null; activeUserRole?: { organisationId?: string | null } | null };
}): string | null {
    return session.user.activeUserRole?.organisationId || session.user.organisationId || null;
}

/** The caller's reachable organisations, or 'ALL' for SUPERADMIN. */
export async function getCallerScope(caller: ScopeCaller): Promise<Set<string> | 'ALL'> {
    if (caller.role === 'SUPERADMIN') return 'ALL';
    if (!caller.organisationId) return new Set();
    return new Set(await getDescendantOrganisationIds(caller.organisationId));
}

export async function loadTargetScope(userId: string): Promise<TargetScope | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            archived: true,
            organisationId: true,
            activeRole: true,
            userRoles: { select: { role: true, organisationId: true } },
        },
    });
    if (!user) return null;
    const organisationIds = new Set<string>();
    for (const ur of user.userRoles) organisationIds.add(ur.organisationId);
    if (user.organisationId) organisationIds.add(user.organisationId);
    const roles = [...user.userRoles.map((ur) => ur.role), user.activeRole].filter(
        (r): r is NonNullable<typeof r> => !!r,
    );
    return {
        id: user.id,
        archived: user.archived,
        organisationIds: [...organisationIds],
        roles,
        highestRole: highestRoleOf(roles),
    };
}

/**
 * Whether `caller` may act on `target` at all.
 *
 * - SUPERADMIN: always.
 * - Otherwise every organisation in the target's scope must be inside the
 *   caller's subtree, and an empty scope is refused — unless `allowUnassigned`
 *   (the first-role-assignment flow, where the caller is about to assign
 *   in-scope roles to a user who holds none yet).
 * - `requireHierarchy` additionally requires the caller to outrank-or-equal the
 *   target's highest role (self is exempt from this, not from scope).
 */
export async function authorizeTargetUser(
    caller: ScopeCaller,
    target: TargetScope,
    options: { allowUnassigned?: boolean; requireHierarchy?: boolean } = {},
): Promise<ScopeDecision> {
    if (caller.role === 'SUPERADMIN') return { ok: true };

    if (target.organisationIds.length === 0) {
        return options.allowUnassigned
            ? { ok: true }
            : { ok: false, status: 403, error: 'Cannot access a user outside your church hierarchy' };
    }

    const scope = await getCallerScope(caller);
    if (scope !== 'ALL' && !target.organisationIds.every((id) => scope.has(id))) {
        return { ok: false, status: 403, error: 'Cannot access a user outside your church hierarchy' };
    }

    if (options.requireHierarchy && caller.id !== target.id) {
        if (target.highestRole && !canManageUser(caller.role, target.highestRole)) {
            return { ok: false, status: 403, error: 'You do not have permission to manage this user' };
        }
    }
    return { ok: true };
}
