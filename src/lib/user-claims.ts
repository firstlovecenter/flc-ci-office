import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Recompute a user's legacy columns (activeRole / activeUserRoleId /
 * organisationId) from their remaining UserRole rows.
 *
 * Authorisation is derived from UserRole rows, so these columns must never
 * outlive the rows they mirror. Call after ANY role revocation or rewrite, and
 * do it unconditionally — not only when the removed row happened to be the
 * active one.
 *
 * - Keeps the current active row if it still exists, otherwise the oldest.
 * - No rows left → all three cleared (login then fails closed).
 * - A pinned SUPERADMIN (activeRole SUPERADMIN) is left alone.
 */
export async function syncLegacyUserColumns(db: Db, userId: string): Promise<void> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { activeRole: true, activeUserRoleId: true },
    });
    if (!user || user.activeRole === 'SUPERADMIN') return;

    const rows = await db.userRole.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, organisationId: true },
    });
    const active = rows.find((r) => r.id === user.activeUserRoleId) ?? rows[0];

    await db.user.update({
        where: { id: userId },
        data: active
            ? { activeUserRoleId: active.id, activeRole: active.role, organisationId: active.organisationId }
            : { activeUserRoleId: null, activeRole: null, organisationId: null },
    });
}
