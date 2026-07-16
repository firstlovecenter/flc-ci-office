// Server-only checks for the "unreceipted approval" request block.
//
// Rule: a leader who has an APPROVED expense request more than 24 hours old
// with no uploaded receipt cannot submit new requests until the receipt is
// uploaded. Only applies to requests approved on/after RECEIPT_ENFORCEMENT_START_DATE
// so pre-existing approvals are grandfathered in. System-generated transaction
// charges (isCharge) are excluded — they're bank/MoMo fees deducted by an
// approver, not a receipted expense request, so they can't have a receipt.
// Transactions the approving admin has explicitly waived (receiptWaived) are
// also excluded — the requirement no longer applies to them.
import { prisma } from '@/lib/prisma';

export const RECEIPT_ENFORCEMENT_START_DATE = new Date('2026-07-08T00:00:00Z');
const RECEIPT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export interface OverdueReceiptTransaction {
    id: string;
    description: string;
    amount: string;
    approvedAt: Date;
}

export async function getOverdueUnreceiptedApprovals(
    userId: string,
    now: Date = new Date(),
): Promise<OverdueReceiptTransaction[]> {
    const transactions = await prisma.transaction.findMany({
        where: {
            userId,
            type: 'EXPENSE',
            isCharge: false,
            receiptWaived: false,
            status: 'APPROVED',
            approvedAt: {
                gte: RECEIPT_ENFORCEMENT_START_DATE,
                lte: new Date(now.getTime() - RECEIPT_GRACE_PERIOD_MS),
            },
            files: { none: {} },
        },
        select: {
            id: true,
            description: true,
            amount: true,
            approvedAt: true,
        },
        orderBy: { approvedAt: 'asc' },
    });

    return transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount.toString(),
        approvedAt: t.approvedAt as Date,
    }));
}
