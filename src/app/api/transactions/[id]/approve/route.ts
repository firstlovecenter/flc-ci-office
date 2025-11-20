import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/notifications';
import { formatCurrency } from '@/lib/utils';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can approve transactions
    const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
        return new NextResponse('Forbidden - Only admins can approve transactions', { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { action, reason } = body; // action: 'approve' or 'reject'

        // Get the transaction
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { department: true },
        });

        if (!transaction) {
            return new NextResponse('Transaction not found', { status: 404 });
        }

        if (transaction.status !== 'PENDING') {
            return new NextResponse('Transaction is not pending approval', { status: 400 });
        }

        // Verify admin has access to this department
        if (session.user.role !== 'SUPERADMIN' && session.user.departmentId) {
            const { getDescendantDepartmentIds } = await import('@/lib/departments');
            const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
            
            if (!allowedDepartmentIds.includes(transaction.departmentId)) {
                return new NextResponse('Forbidden - Cannot approve transactions for this department', { status: 403 });
            }
        }

        // Update transaction status
        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                approvedBy: session.user.id,
                approvedAt: new Date(),
                rejectedReason: action === 'reject' ? reason : null,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: id,
                beforeData: transaction as any,
                afterData: updatedTransaction as any,
            },
        });

        // Send push notification to the transaction creator
        if (transaction.userId) {
            const notificationTitle = action === 'approve' 
                ? '✅ Transaction Approved' 
                : '❌ Transaction Rejected';
            const notificationBody = action === 'approve'
                ? `Your ${transaction.type.toLowerCase()} of ${formatCurrency(Number(transaction.amount))} has been approved`
                : `Your ${transaction.type.toLowerCase()} of ${formatCurrency(Number(transaction.amount))} was rejected${reason ? `: ${reason}` : ''}`;

            await sendPushNotification([transaction.userId], {
                title: notificationTitle,
                body: notificationBody,
                url: '/transactions',
                tag: `transaction-${action}`,
                requireInteraction: true,
            }).catch(err => {
                console.error('Failed to send push notification:', err);
                // Don't fail the request if notification fails
            });
        }

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        console.error('Error approving transaction:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
