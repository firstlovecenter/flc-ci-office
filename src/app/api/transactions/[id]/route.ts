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
        const { type, amount, description, departmentId } = body;
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

        // Update the transaction
        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                type,
                amount,
                description,
                departmentId,
                updatedAt: new Date(),
            },
            include: {
                department: true,
                user: true,
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
            // Only superadmin can delete locked transactions
            if (session.user.role !== 'SUPERADMIN') {
                return NextResponse.json(
                    { error: 'Transaction is locked. Only superadmins can delete locked transactions.' },
                    { status: 403 }
                );
            }
        }

        // Validate that the user can delete transaction for this department
        const canAccess = await hasDepartmentAccess(session.user, existingTransaction.departmentId);
        if (!canAccess && session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'You do not have access to this department' },
                { status: 403 }
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
