import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess } from '@/lib/departments';
import { sendSms } from '@/lib/sms';
import { generateTransactionApprovedSms, generateTransactionDeclinedSms, generateTransactionChargeSms } from '@/lib/sms-templates';
import { formatNumber } from '@/lib/utils';

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
                    { error: 'This transaction is locked. Only superadmins can edit locked transactions.' },
                    { status: 403 }
                );
            }
        }

        // Check if transaction is approved - only CAMPUS_ADMIN and above can edit
        if (existingTransaction.status === 'APPROVED') {
            const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
            if (!adminRoles.includes(session.user.role)) {
                return NextResponse.json(
                    { error: 'Only Campus Admin and above can edit approved transactions' },
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
        const { status, rejectionReason, approvedAmount, charges } = body;
        const transactionId = params.id;

        // Validate status
        if (!['APPROVED', 'DECLINED'].includes(status)) {
            return new NextResponse('Invalid status', { status: 400 });
        }

        // Get the transaction
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                department: true,
                user: true,
                currency: true,
            },
        });

        if (!transaction) {
            return new NextResponse('Transaction not found', { status: 404 });
        }

        // Check if transaction is already approved or declined
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
                { role: session.user.role, departmentId: session.user.departmentId },
                transaction.departmentId
            );

            if (!hasAccess) {
                return new NextResponse('You do not have access to this department', { status: 403 });
            }
        }

        // Update transaction status
        let finalApprovedAmount = transaction.amount;
        if (status === 'APPROVED' && approvedAmount !== undefined) {
            finalApprovedAmount = approvedAmount;
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status,
                amount: status === 'APPROVED' && approvedAmount !== undefined ? approvedAmount : transaction.amount,
                approvedBy: status === 'APPROVED' ? session.user.id : undefined,
                approvedAt: status === 'APPROVED' ? new Date() : undefined,
                rejectedBy: status === 'DECLINED' ? session.user.id : undefined,
                rejectedAt: status === 'DECLINED' ? new Date() : undefined,
                rejectionReason: status === 'DECLINED' ? rejectionReason : undefined,
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
                        phone: true,
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

        // Create transaction charge as DEBIT (EXPENSE) if charges are specified
        if (status === 'APPROVED' && charges && parseFloat(charges) > 0) {
            const chargeAmount = parseFloat(charges);
            let chargeAmountInBase = chargeAmount;
            
            // Convert to base currency if needed
            if (transaction.currencyId && transaction.exchangeRate) {
                chargeAmountInBase = chargeAmount * Number(transaction.exchangeRate);
            }

            const chargeTransaction = await prisma.transaction.create({
                data: {
                    type: 'EXPENSE', // Transaction charge is always a debit/expense
                    amount: chargeAmount,
                    amountInBase: chargeAmountInBase,
                    description: `Transaction charge for: ${transaction.description.substring(0, 50)}${transaction.description.length > 50 ? '...' : ''} - Ref: ${transaction.id.substring(0, 8)}`,
                    departmentId: transaction.departmentId,
                    userId: session.user.id, // Charge created by approving admin
                    currencyId: transaction.currencyId,
                    exchangeRate: transaction.exchangeRate,
                    status: 'APPROVED', // Auto-approve transaction charges
                    approvedBy: session.user.id,
                    approvedAt: new Date(),
                    locked: false,
                    weekNumber: transaction.weekNumber,
                    year: transaction.year,
                },
            });

            // Send SMS notification to the department leader about the charge
            try {
                // Find the department leader based on department level
                const leaderRole = updatedTransaction.department.level === 'GLOBAL' ? 'GLOBAL_LEADER' :
                                  updatedTransaction.department.level === 'INTERNATIONAL' ? 'INTERNATIONAL_LEADER' :
                                  updatedTransaction.department.level === 'NATIONAL' ? 'NATIONAL_LEADER' :
                                  updatedTransaction.department.level === 'REGIONAL' ? 'REGIONAL_LEADER' :
                                  updatedTransaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  updatedTransaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                const departmentLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        departmentId: updatedTransaction.department.id,
                    },
                    include: {
                        user: {
                            select: {
                                phone: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter active users with phone numbers
                const leaders = departmentLeaderRoles
                    .filter(ur => ur.user.phone && !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone!, name: ur.user.name }));

                if (leaders.length > 0) {
                    const currencySymbol = updatedTransaction.currency?.symbol || '$';
                    const smsMessage = await generateTransactionChargeSms({
                        currency: currencySymbol,
                        chargeAmount: formatNumber(chargeAmount),
                        departmentName: transaction.department.name,
                        transactionRef: transaction.id.substring(0, 8),
                        description: transaction.description.substring(0, 25) + (transaction.description.length > 25 ? '...' : ''),
                    });
                    
                    for (const leader of leaders) {
                        if (leader.phone) {
                            try {
                                await sendSms({
                                    to: leader.phone,
                                    message: smsMessage
                                });
                                console.log(`Transaction charge SMS sent to leader: ${leader.name} (${leader.phone})`);
                            } catch (err) {
                                console.error(`Failed to send transaction charge SMS to ${leader.name}:`, err);
                            }
                        }
                    }
                } else {
                    console.warn('No department leaders found for transaction charge notification');
                }
            } catch (smsError) {
                console.error('Failed to send transaction charge SMS to leader:', smsError);
                // Don't fail the request if SMS fails
            }
        }

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
                    rejectedBy: status === 'DECLINED' ? session.user.id : undefined,
                    rejectionReason: status === 'DECLINED' ? rejectionReason : undefined,
                },
            },
        });

        // Send SMS notification to the user who created the transaction
        if (updatedTransaction.user.phone) {
            try {
                const currencySymbol = updatedTransaction.currency?.symbol || '$';
                const transactionType = updatedTransaction.type === 'EXPENSE' ? 'expense' : 'income';
                
                let smsMessage = '';
                if (status === 'APPROVED') {
                    // Calculate the department balance after this transaction and charges
                    const departmentTransactions = await prisma.transaction.findMany({
                        where: {
                            departmentId: updatedTransaction.department.id,
                            status: 'APPROVED',
                        },
                        select: {
                            type: true,
                            amountInBase: true,
                            amount: true,
                        },
                    });

                    const balance = departmentTransactions.reduce((sum, tx) => {
                        const txAmount = Number(tx.amountInBase || tx.amount);
                        return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
                    }, 0);

                    // Build the charge text
                    const chargeAmount = charges && parseFloat(charges) > 0 ? parseFloat(charges) : 0;
                    const chargeText = chargeAmount > 0 ? ` Charge: ${currencySymbol}${chargeAmount.toFixed(2)}.` : '';
                    
                    smsMessage = await generateTransactionApprovedSms({
                        transactionType,
                        currency: currencySymbol,
                        amount: updatedTransaction.amount.toFixed(2),
                        chargeText,
                        departmentName: updatedTransaction.department.name,
                        balance: balance.toFixed(2),
                    });
                } else {
                    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
                    smsMessage = await generateTransactionDeclinedSms({
                        transactionType,
                        currency: currencySymbol,
                        amount: updatedTransaction.amount.toFixed(2),
                        reasonText,
                    });
                }
                
                await sendSms({
                    to: updatedTransaction.user.phone,
                    message: smsMessage
                });
            } catch (smsError) {
                console.error('Failed to send SMS notification:', smsError);
                // Don't fail the request if SMS fails
            }
        }

        return NextResponse.json(updatedTransaction);
    } catch (error) {
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
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
