/**
 * Cancelled withdrawal requests.
 *
 * A cancel is stored as status REJECTED with `cancelledAt` set, not as its own
 * enum value: code deployed before the change cannot read an unknown enum value
 * (Prisma throws), so a new value would break rollbacks and other branches'
 * previews, which share the database. Older code shows a cancel as "Declined";
 * this code shows it as "Cancelled" and keeps it out of declined figures.
 */

import type { Prisma, TransactionStatus } from '@prisma/client';

export type DisplayStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** The status to show and filter by: REJECTED splits into declined and cancelled. */
export function displayStatus(tx: { status: string; cancelledAt?: string | Date | null }): DisplayStatus | string {
    return tx.status === 'REJECTED' && tx.cancelledAt ? 'CANCELLED' : tx.status;
}

/**
 * Prisma `where` fragment for a display-status filter. Declined excludes
 * cancellations, and Cancelled selects only them.
 */
export function statusWhere(status: string): Prisma.TransactionWhereInput {
    if (status === 'CANCELLED') return { status: 'REJECTED', cancelledAt: { not: null } };
    if (status === 'REJECTED') return { status: 'REJECTED', cancelledAt: null };
    return { status: status as TransactionStatus };
}

/**
 * Whether a user may cancel a transaction: only the requester, only a
 * withdrawal, and only while it is still pending. Shared by the ledger's
 * Cancel button and the cancel API so the two cannot disagree.
 */
export function canCancelRequest(
    tx: { type: string; status: string; userId: string },
    userId: string | null | undefined,
): boolean {
    return !!userId && tx.userId === userId && tx.type === 'EXPENSE' && tx.status === 'PENDING';
}
