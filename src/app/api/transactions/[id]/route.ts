import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess } from '@/lib/departments';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { type, amount, description, departmentId, currencyId, exchangeRate, date, files } = body;
        const transactionId = params.id;

        // Get the existing transaction
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
        });

        if (!existingTransaction) {
            return NextResponse.json(
                { error: 'Transaction not found' },
                { status: 404 }
            );
        }

        // Check if transaction is locked
        if (existingTransaction.locked) {
            // Only superadmin can edit locked transactions
            if (session.user.role !== 'SUPERADMIN') {
                return NextResponse.json(
                    { error: 'Transaction is locked. Only superadmins can edit locked transactions.' },
                    { status: 403 }
                );
            }
        }

        // Validate that the user can update transaction for this department
        const canAccess = await hasDepartmentAccess(session.user, departmentId);
        if (!canAccess && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'You do not have access to this department' },
                { status: 403 }
            );
        }

        // Calculate amount in base currency if using a different currency
        let amountInBase = amount; // Default to the original amount
        if (currencyId && exchangeRate) {
            amountInBase = amount * exchangeRate;
        }

        // Update the transaction
        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                type,
                amount,
                description,
                departmentId,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                ...(date ? { createdAt: new Date(date) } : {}),
                updatedAt: new Date(),
                ...(files && files.length > 0 ? {
                    files: {
                        create: files.map((f: any) => ({
                            fileName: f.name,
                            fileUrl: f.url,
                            fileMime: f.mime,
                            uploadedBy: session.user.id,
                        })),
                    }
                } : {}),
            },
            include: {
                department: true,
                user: true,
                currency: true,
                files: true,
            },
        });

        // Create audit log for the update
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transactionId,
                afterData: { description, type, amount, departmentId, locked: existingTransaction.locked },
            },
        });

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { status, rejectionReason } = body;
        const transactionId = params.id;

        // Validate status
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return new NextResponse('Invalid status', { status: 400 });
        }

        // Get the transaction
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                department: true,
                user: true,
            },
        });

        if (!transaction) {
            return new NextResponse('Transaction not found', { status: 404 });
        }

        // Check if transaction is already approved or rejected
        if (transaction.status !== 'PENDING') {
            return new NextResponse(`Transaction already ${transaction.status.toLowerCase()}`, { status: 400 });
        }

        // Check if user has permission (must be admin role)
        const adminRoles = ['CAMPUS_ADMIN', 'REGIONAL_ADMIN', 'NATIONAL_ADMIN', 'INTERNATIONAL_ADMIN', 'GLOBAL_ADMIN', 'SUPERADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return new NextResponse('Only admins can approve/reject transactions', { status: 403 });
        }

        // Check if the admin has access to this department
        if (session.user.role !== 'SUPERADMIN') {
            const hasAccess = await hasDepartmentAccess(
                session.user.departmentId!,
                transaction.departmentId
            );

            if (!hasAccess) {
                return new NextResponse('You do not have access to this department', { status: 403 });
            }
        }

        // Update transaction status
        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status,
                approvedBy: status === 'APPROVED' ? session.user.id : undefined,
                approvedAt: status === 'APPROVED' ? new Date() : undefined,
                rejectedBy: status === 'REJECTED' ? session.user.id : undefined,
                rejectedAt: status === 'REJECTED' ? new Date() : undefined,
                rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                currency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
            },
        });

        // Create audit log for the approval/rejection
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transactionId,
                afterData: { 
                    status, 
                    approvedBy: status === 'APPROVED' ? session.user.id : undefined,
                    rejectedBy: status === 'REJECTED' ? session.user.id : undefined,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                },
            },
        });

        // TODO: Send push notification to the user who created the transaction
        // await sendPushNotification([transaction.userId], {
        //     title: status === 'APPROVED' ? 'Transaction Approved' : 'Transaction Rejected',
        //     body: `Your transaction "${transaction.description}" has been ${status.toLowerCase()}`,
        //     url: `/transactions`,
        // });

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction status:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const transactionId = params.id;

        // Only SUPERADMIN can delete transactions
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Forbidden - Only superadmin can delete transactions' },
                { status: 403 }
            );
        }

        // Get the existing transaction
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
        });

        if (!existingTransaction) {
            return NextResponse.json(
                { error: 'Transaction not found' },
                { status: 404 }
            );
        }

        // Delete the transaction
        await prisma.transaction.delete({
            where: { id: transactionId },
        });

        // Create audit log for the deletion
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Transaction',
                entityId: transactionId,
                beforeData: { 
                    description: existingTransaction.description, 
                    type: existingTransaction.type,
                    amount: existingTransaction.amount,
                    locked: existingTransaction.locked 
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
