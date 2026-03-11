import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { hasDepartmentAccess } from '@/lib/departments';
import { sendSms } from '@/lib/sms';
import { generateTransactionApprovedSms, generateTransactionDeclinedSms, generateTransactionChargeSms, generateCreditAlertSms, generateDebitAlertSms, generateTransactionEditNotificationSms } from '@/lib/sms-templates';
import { formatNumber, isWeekLocked, getWeekFromDate } from '@/lib/utils';

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

        // Only admins can edit transactions
        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Only admins can edit transactions.' },
                { status: 403 }
            );
        }

        // Check if transaction is locked - only superadmin can edit locked transactions
        if (existingTransaction.locked) {
            if (session.user.role !== 'SUPERADMIN') {
                return NextResponse.json(
                    { error: 'This transaction is locked. Only superadmins can edit locked transactions.' },
                    { status: 403 }
                );
            }
        }

        // Check if transaction's week is locked - only oversight and above can edit past-week transactions
        if (existingTransaction.weekNumber && existingTransaction.year) {
            if (isWeekLocked(existingTransaction.weekNumber, existingTransaction.year)) {
                const oversightAndAboveRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN'];
                if (!oversightAndAboveRoles.includes(session.user.role)) {
                    return NextResponse.json(
                        { error: 'This transaction belongs to a locked week. Only Oversight Admin and above can edit past-week transactions.' },
                        { status: 403 }
                    );
                }
            }
        }

        // Validate department access for non-superadmin
        if (session.user.role !== 'SUPERADMIN') {
            const canAccessSource = await hasDepartmentAccess(session.user, existingTransaction.departmentId);
            if (!canAccessSource) {
                return NextResponse.json(
                    { error: 'You do not have access to the transaction\'s current department' },
                    { status: 403 }
                );
            }
            const canAccessDest = await hasDepartmentAccess(session.user, departmentId);
            if (!canAccessDest) {
                return NextResponse.json(
                    { error: 'You do not have access to the destination department' },
                    { status: 403 }
                );
            }
        }

        // Calculate amount in base currency if using a different currency
        let amountInBase = amount; // Default to the original amount
        if (currencyId && exchangeRate) {
            amountInBase = amount * exchangeRate;
        }

        // If date is provided, recalculate week number and year from the new date
        let weekData: { weekNumber?: number; year?: number } = {};
        if (date) {
            const newDate = new Date(date);
            const weekInfo = getWeekFromDate(newDate);
            weekData = { weekNumber: weekInfo.weekNumber, year: weekInfo.year };
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
                ...weekData,
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
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transactionId,
                beforeData: {
                    type: existingTransaction.type,
                    amount: Number(existingTransaction.amount),
                    description: existingTransaction.description,
                    departmentId: existingTransaction.departmentId,
                    createdAt: existingTransaction.createdAt,
                },
                afterData: { description, type, amount, departmentId, ...(date ? { createdAt: new Date(date) } : {}), locked: existingTransaction.locked },
            },
        });

        // Detect what changed (for SMS notification)
        const amountChanged = Number(existingTransaction.amount) !== Number(amount);
        const typeChanged = existingTransaction.type !== type;
        const descriptionChanged = existingTransaction.description !== description;
        const departmentChanged = existingTransaction.departmentId !== departmentId;
        const currencyChanged = (existingTransaction.currencyId || null) !== (currencyId || null);
        const dateChanged = date ? new Date(date).toDateString() !== new Date(existingTransaction.createdAt).toDateString() : false;

        const nonDateFieldChanged = amountChanged || typeChanged || descriptionChanged || departmentChanged || currencyChanged;

        // Send SMS to department leaders if anything other than date changed
        if (nonDateFieldChanged) {
            try {
                // Build a human-readable changes summary
                const changesList: string[] = [];
                if (amountChanged) changesList.push(`Amount: ${Number(existingTransaction.amount)} → ${amount}`);
                if (typeChanged) changesList.push(`Type: ${existingTransaction.type} → ${type}`);
                if (descriptionChanged) changesList.push(`Desc updated`);
                if (departmentChanged) changesList.push(`Dept changed`);
                if (currencyChanged) changesList.push(`Currency changed`);
                const changesSummary = changesList.join(', ');

                // Determine the department(s) whose leaders need to be notified
                const departmentIds = new Set([existingTransaction.departmentId]);
                if (departmentChanged) departmentIds.add(departmentId);

                for (const deptId of departmentIds) {
                    const dept = await prisma.department.findUnique({
                        where: { id: deptId },
                        select: { id: true, name: true, level: true },
                    });
                    if (!dept || !dept.level) continue;

                    const leaderRole = dept.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                        dept.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                        dept.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                        dept.level === 'STREAM' ? 'STREAM_LEADER' :
                        'COUNCIL_LEADER';

                    const leaders = await prisma.userRole.findMany({
                        where: { role: leaderRole, departmentId: deptId },
                        include: { user: { select: { phone: true, name: true, archived: true } } },
                    });

                    const smsMessage = generateTransactionEditNotificationSms({
                        departmentName: dept.name,
                        description: existingTransaction.description || description,
                        changes: changesSummary,
                        editedBy: session.user.name || 'Admin',
                    });

                    for (const lr of leaders.filter(ur => ur.user.phone && !ur.user.archived)) {
                        await sendSms({ to: lr.user.phone!, message: smsMessage }).catch(() => {});
                    }
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
            }
        }

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
        if (!['APPROVED', 'REJECTED'].includes(status)) {
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
        const adminRoles = ['CAMPUS_ADMIN', 'OVERSIGHT_ADMIN', 'DENOMINATION_ADMIN', 'SUPERADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return new NextResponse('Only admins can approve/reject transactions', { status: 403 });
        }

        // Check if the admin has access to this department
        if (session.user.role !== 'SUPERADMIN') {
            const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
            
            const hasAccess = await hasDepartmentAccess(
                { role: session.user.role, departmentId: filterDepartmentId },
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
                    id: crypto.randomUUID(),
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
                    updatedAt: new Date(),
                },
            });

            // Send SMS notification to the department leader about the charge
            try {
                // Find the department leader based on department level
                const leaderRole = updatedTransaction.department.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  updatedTransaction.department.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
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
                            } catch (err) {
                                console.error('Failed to send SMS to leader:', err);
                            }
                        }
                    }
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('SMS notification error:', smsError);
            }
        }

        // Create audit log for the approval/rejection
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
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
                
                console.log(`[SMS] Sending ${status} notification to transaction creator: ${updatedTransaction.user.phone}`);
                const sent = await sendSms({
                    to: updatedTransaction.user.phone,
                    message: smsMessage
                });
                console.log(`[SMS] Transaction ${status} notification: ${sent ? 'SUCCESS' : 'FAILED'}`);
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error sending approval/decline notification:', smsError);
            }
        }

        // Send credit/debit alert SMS to the department leader when approved
        if (status === 'APPROVED') {
            try {
                // Determine the leader role based on department level
                const leaderRole = updatedTransaction.department.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  updatedTransaction.department.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                                  updatedTransaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  updatedTransaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                // Find all users with the leader role for this department
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
                    // Calculate the department balance
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

                    const currencySymbol = updatedTransaction.currency?.symbol || '$';
                    const transactionDescription = updatedTransaction.description || (updatedTransaction.type === 'INCOME' ? 'Income' : 'Expense');

                    // Generate credit or debit alert based on transaction type
                    let alertMessage: string;
                    if (updatedTransaction.type === 'INCOME') {
                        alertMessage = await generateCreditAlertSms({
                            currency: currencySymbol,
                            amount: formatNumber(Number(updatedTransaction.amount)),
                            description: transactionDescription.substring(0, 30) + (transactionDescription.length > 30 ? '...' : ''),
                            departmentName: updatedTransaction.department.name,
                            balance: formatNumber(balance),
                        });
                    } else {
                        alertMessage = await generateDebitAlertSms({
                            currency: currencySymbol,
                            amount: formatNumber(Number(updatedTransaction.amount)),
                            description: transactionDescription.substring(0, 30) + (transactionDescription.length > 30 ? '...' : ''),
                            departmentName: updatedTransaction.department.name,
                            balance: formatNumber(balance),
                        });
                    }

                    // Send to all leaders
                    for (const leader of leaders) {
                        try {
                            console.log(`[SMS] Sending ${updatedTransaction.type === 'INCOME' ? 'credit' : 'debit'} alert to leader: ${leader.phone}`);
                            await sendSms({
                                to: leader.phone,
                                message: alertMessage
                            });
                        } catch (err) {
                            console.error(`[SMS] Failed to send alert to leader ${leader.phone}:`, err);
                        }
                    }
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error sending credit/debit alert to leader:', smsError);
            }
        }

        // Calculate final balance for response
        let newBalance: number | null = null;
        let balanceCurrency: { code: string; symbol: string } | null = null;
        
        try {
            const departmentTransactions = await prisma.transaction.findMany({
                where: {
                    departmentId: updatedTransaction.department.id,
                    status: 'APPROVED',
                },
                select: {
                    type: true,
                    amount: true,
                },
            });

            newBalance = departmentTransactions.reduce((sum, tx) => {
                const txAmount = Number(tx.amount);
                return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
            }, 0);

            // Get currency from department's base currency
            const dept = await prisma.department.findUnique({
                where: { id: updatedTransaction.department.id },
                include: { departmentBaseCurrency: { include: { currency: true } } },
            });
            if (dept?.departmentBaseCurrency?.currency) {
                balanceCurrency = {
                    code: dept.departmentBaseCurrency.currency.code,
                    symbol: dept.departmentBaseCurrency.currency.symbol,
                };
            } else if (updatedTransaction.currency) {
                balanceCurrency = {
                    code: updatedTransaction.currency.code,
                    symbol: updatedTransaction.currency.symbol,
                };
            }
        } catch (balanceError) {
            console.error('[Balance] Error calculating new balance:', balanceError);
        }

        return NextResponse.json({
            ...updatedTransaction,
            newBalance,
            currency: balanceCurrency,
        });
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
                id: crypto.randomUUID(),
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
