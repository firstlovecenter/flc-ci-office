/**
 * Whether a user may cancel a transaction.
 *
 * Only the requester, only a withdrawal, and only while it is still pending —
 * once an admin has approved or declined it the decision stands. Shared by the
 * ledger's Cancel button and the cancel API so the two cannot disagree.
 */
export function canCancelRequest(
    tx: { type: string; status: string; userId: string },
    userId: string | null | undefined,
): boolean {
    return !!userId && tx.userId === userId && tx.type === 'EXPENSE' && tx.status === 'PENDING';
}
