import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { moneyToString } from '@/lib/money';
import { canCancelRequest, displayStatus } from '@/lib/cancel-request';

export const dynamic = 'force-dynamic';

// Lets the person who submitted a withdrawal request cancel it while it is
// still pending. Once an admin has approved or declined it, it can no longer be
// cancelled. The row is kept so the ledger and audit trail still show that the
// request existed: status REJECTED with cancelledAt set (see lib/cancel-request.ts
// for why not a CANCELLED enum value). rejectedBy stays null — nobody declined it.
export async function POST(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await context.params;

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { id: true, type: true, status: true, cancelledAt: true, userId: true, amount: true, description: true },
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.userId !== session.user.id) {
        return NextResponse.json({ error: 'Only the person who made this request can cancel it.' }, { status: 403 });
    }

    if (transaction.type !== 'EXPENSE') {
        return NextResponse.json({ error: 'Only withdrawal requests can be cancelled.' }, { status: 400 });
    }

    // Fast path for a stale page; the conditional update below is what actually guards.
    if (!canCancelRequest(transaction, session.user.id)) {
        return alreadyDecided(transaction);
    }

    // Conditional on PENDING so an approval landing at the same moment wins
    // cleanly instead of being overwritten.
    const { count } = await prisma.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: { status: 'REJECTED', cancelledAt: new Date(), updatedAt: new Date() },
    });

    if (count === 0) {
        const current = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { status: true, cancelledAt: true } });
        return alreadyDecided(current);
    }

    await createAuditLog({
        userId: session.user.id,
        actionType: 'UPDATE',
        entityType: 'Transaction',
        entityId: transactionId,
        description: 'Cancelled pending withdrawal request',
        beforeData: { status: 'PENDING' },
        afterData: { status: 'REJECTED', cancelled: true },
        metadata: { name: transaction.description, amount: moneyToString(transaction.amount), cancelled: true },
        severity: 'MEDIUM',
    });

    const updated = await prisma.transaction.findUnique({ where: { id: transactionId } });
    return NextResponse.json(updated);
}

function alreadyDecided(tx: { status: string; cancelledAt: Date | null } | null) {
    const status = tx ? displayStatus(tx) : null;
    const state = status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'declined' : 'cancelled';
    return NextResponse.json(
        { error: `This request has already been ${state} and can no longer be cancelled.` },
        { status: 409 },
    );
}
