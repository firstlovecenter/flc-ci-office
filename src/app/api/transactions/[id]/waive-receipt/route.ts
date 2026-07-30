import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasOrganisationAccess } from '@/lib/organisations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Lets the approving admin waive the receipt requirement for an already
// approved expense — e.g. when the receipt was lost or never issued. Only
// admins may waive; the requester who submitted the expense cannot waive
// their own receipt requirement.
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    const isAdmin = role === 'SUPERADMIN' || (typeof role === 'string' && role.endsWith('_ADMIN'));
    if (!isAdmin) {
        return NextResponse.json({ error: 'Only an approving admin can waive a receipt.' }, { status: 403 });
    }

    let body: { reason?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
    }

    const reason = body.reason?.trim();
    if (!reason) {
        return NextResponse.json({ error: 'A reason is required to waive a receipt.' }, { status: 400 });
    }

    const { id: transactionId } = await context.params;

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
            id: true,
            type: true,
            status: true,
            organisationId: true,
            isCharge: true,
            receiptWaived: true,
            files: { select: { id: true } },
        },
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.type !== 'EXPENSE') {
        return NextResponse.json({ error: 'Only expense transactions require a receipt.' }, { status: 400 });
    }

    if (transaction.isCharge) {
        return NextResponse.json({ error: 'Transaction charges are system-generated fees and do not require a receipt.' }, { status: 400 });
    }

    if (transaction.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Only approved expenses can have their receipt requirement waived.' }, { status: 400 });
    }

    if (transaction.files.length > 0) {
        return NextResponse.json({ error: 'A receipt is already attached to this transaction.' }, { status: 400 });
    }

    if (transaction.receiptWaived) {
        return NextResponse.json({ error: 'The receipt requirement has already been waived for this transaction.' }, { status: 400 });
    }

    const hasScopedAccess = await hasOrganisationAccess(
        { role, organisationId: session.user.organisationId },
        transaction.organisationId,
    );

    if (!hasScopedAccess) {
        return NextResponse.json(
            { error: 'You do not have permission to waive the receipt for this transaction.' },
            { status: 403 },
        );
    }

    const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
            receiptWaived: true,
            receiptWaivedAt: new Date(),
            receiptWaivedBy: session.user.id,
            receiptWaivedReason: reason,
        },
        include: {
            receiptWaivedByUser: { select: { id: true, name: true, email: true } },
        },
    });

    await createAuditLog({
        userId: session.user.id,
        actionType: 'RECEIPT_WAIVED',
        entityType: 'Transaction',
        entityId: transactionId,
        description: `Waived receipt requirement for transaction`,
        metadata: { reason },
        severity: 'HIGH',
    });

    return NextResponse.json(updated);
}
