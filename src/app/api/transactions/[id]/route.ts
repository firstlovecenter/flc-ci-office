import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { hasDepartmentAccess } from '@/lib/departments';
import { sendSms } from '@/lib/sms';
import { generateTransactionApprovedSms, generateTransactionDeclinedSms, generateTransactionChargeSms, generateCreditAlertSms, generateDebitAlertSms, generateTransactionEditNotificationSms, generateApproverApprovedSms, generateApproverDeclinedSms } from '@/lib/sms-templates';
import { formatNumber, isWeekLocked, getWeekFromDate } from '@/lib/utils';
import { toDecimal, eq, moneyToString, toMoney2dp } from '@/lib/money';
import { getDepartmentApprovedBalance } from '@/lib/balance';

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
        const { type, amount, description, departmentId, currencyId, exchangeRate, date } = body;
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

        // Calculate amount in base currency using Decimal arithmetic and clamp to 2dp.
        const amountDec = toDecimal(amount);
        const amountInBaseDec = currencyId && exchangeRate
            ? amountDec.mul(toDecimal(exchangeRate))
            : amountDec;
        const amountToPersist = toMoney2dp(amountDec);
        const amountInBase = toMoney2dp(amountInBaseDec);

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
                amount: amountToPersist,
                description,
                departmentId,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                ...(date ? { createdAt: new Date(date) } : {}),
                ...weekData,
                updatedAt: new Date(),
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
                    amount: moneyToString(existingTransaction.amount),
                    description: existingTransaction.description,
                    departmentId: existingTransaction.departmentId,
                    createdAt: existingTransaction.createdAt,
                },
                afterData: { description, type, amount, departmentId, ...(date ? { createdAt: new Date(date) } : {}), locked: existingTransaction.locked },
            },
        });

        // Detect what changed (for SMS notification)
        const amountChanged = !eq(existingTransaction.amount, amount);
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
                if (amountChanged) changesList.push(`Amount: ${moneyToString(existingTransaction.amount)} → ${moneyToString(amount)}`);
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
                        include: { user: { select: { phone: true, email: true, name: true, archived: true } } },
                    });

                    const smsMessage = generateTransactionEditNotificationSms({
                        departmentName: dept.name,
                        description: existingTransaction.description || description,
                        changes: changesSummary,
                        editedBy: session.user.name || 'Admin',
                    });

                    for (const lr of leaders.filter(ur => !ur.user.archived)) {
                        if (lr.user.phone) await sendSms({ to: lr.user.phone!, message: smsMessage }).catch(() => {});
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

        // Create transaction charge as DEBIT (EXPENSE) if charges are specified.
        // Use Decimal arithmetic so the stored values are exact.
        const chargeDec = charges ? toDecimal(charges) : null;
        if (status === 'APPROVED' && chargeDec && chargeDec.gt(0)) {
            const chargeAmountInBaseDec = transaction.currencyId && transaction.exchangeRate
                ? chargeDec.mul(toDecimal(transaction.exchangeRate))
                : chargeDec;

            const chargeTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: 'EXPENSE', // Transaction charge is always a debit/expense
                    amount: toMoney2dp(chargeDec),
                    amountInBase: toMoney2dp(chargeAmountInBaseDec),
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
                                email: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter active users
                const leaders = departmentLeaderRoles
                    .filter(ur => !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name }));

                if (leaders.length > 0) {
                    const currencySymbol = updatedTransaction.currency?.symbol || '$';
                    const chargeRef = transaction.id.substring(0, 8);
                    const chargeDesc = transaction.description.substring(0, 25) + (transaction.description.length > 25 ? '...' : '');
                    const chargeAmountStr = formatNumber(chargeDec.toString());
                    const smsMessage = await generateTransactionChargeSms({
                        currency: currencySymbol,
                        chargeAmount: chargeAmountStr,
                        departmentName: transaction.department.name,
                        transactionRef: chargeRef,
                        description: chargeDesc,
                    });

                    for (const leader of leaders) {
                        try {
                            // The creator's approval SMS already states the charge, so skip
                            // them here to avoid a separate, duplicate charge message.
                            if (leader.phone && leader.phone === updatedTransaction.user.phone) {
                                console.log(`[SMS] Skipping charge notification for ${leader.phone}; included in approval SMS`);
                                continue;
                            }
                            if (leader.phone) {
                                await sendSms({ to: leader.phone, message: smsMessage }).catch(() => false);
                            }
                            } catch (err) {
                            console.error('Failed to send charge notification to leader:', err);
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

        // Fetch balance once for APPROVED — reused for both creator and approver notifications
        const approvedBalance = status === 'APPROVED'
            ? await getDepartmentApprovedBalance(updatedTransaction.department.id)
            : null;

        // Track the creator's phone if we notify them. The approval SMS already
        // includes the new balance, so the credit/debit alert below skips this
        // phone to avoid sending the same leader two messages for one approval.
        let creatorNotifiedPhone: string | null = null;

        // Send notification to the user who created the transaction
        if (updatedTransaction.user.phone || updatedTransaction.user.email) {
            try {
                const currencySymbol = updatedTransaction.currency?.symbol || '$';
                const transactionType = updatedTransaction.type === 'EXPENSE' ? 'expense' : 'income';

                let smsMessage = '';
                if (status === 'APPROVED') {
                    const chargeForText = chargeDec && chargeDec.gt(0) ? chargeDec : null;
                    const chargeText = chargeForText ? ` Charge: ${currencySymbol}${formatNumber(chargeForText.toString())}.` : '';

                    const refText = updatedTransaction.description || (updatedTransaction.type === 'INCOME' ? 'Income' : 'Expense');
                    const refShort = refText.substring(0, 30) + (refText.length > 30 ? '...' : '');

                    smsMessage = await generateTransactionApprovedSms({
                        transactionType,
                        currency: currencySymbol,
                        amount: formatNumber(moneyToString(updatedTransaction.amount)),
                        chargeText,
                        departmentName: updatedTransaction.department.name,
                        balance: formatNumber(moneyToString(approvedBalance!)),
                        description: refShort,
                    });
                } else {
                    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
                    smsMessage = await generateTransactionDeclinedSms({
                        transactionType,
                        currency: currencySymbol,
                        amount: formatNumber(moneyToString(updatedTransaction.amount)),
                        reasonText,
                    });
                }

                if (updatedTransaction.user.phone) {
                    console.log(`[SMS] Sending ${status} notification to transaction creator: ${updatedTransaction.user.phone}`);
                    const sent = await sendSms({
                        to: updatedTransaction.user.phone,
                        message: smsMessage
                    }).catch(() => false);
                    console.log(`[SMS] Transaction ${status} notification: ${sent ? 'SUCCESS' : 'FAILED'}`);
                    creatorNotifiedPhone = updatedTransaction.user.phone;
                }

            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error sending approval/decline notification:', smsError);
            }
        }

        // Send confirmation notification to the approver
        try {
            const approverUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { phone: true, name: true },
            });

            if (approverUser?.phone) {
                const currencySymbol = updatedTransaction.currency?.symbol || '$';
                const transactionType = updatedTransaction.type === 'EXPENSE' ? 'expense' : 'income';
                const submitterName = updatedTransaction.user.name || 'User';
                const deptName = updatedTransaction.department.name;
                const amountStr = formatNumber(moneyToString(updatedTransaction.amount));

                if (status === 'APPROVED') {
                    const balStr = formatNumber(moneyToString(approvedBalance!));
                    const chargeText = chargeDec && chargeDec.gt(0)
                        ? ` Charge: ${currencySymbol}${formatNumber(chargeDec.toString())}.`
                        : '';
                    const sms = generateApproverApprovedSms({
                        transactionType, currency: currencySymbol, amount: amountStr,
                        submitterName, departmentName: deptName, balance: balStr, chargeText,
                    });
                    await sendSms({ to: approverUser.phone, message: sms }).catch(() => false);
                } else {
                    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
                    const sms = generateApproverDeclinedSms({
                        transactionType, currency: currencySymbol, amount: amountStr,
                        submitterName, departmentName: deptName, reasonText,
                    });
                    await sendSms({ to: approverUser.phone, message: sms }).catch(() => false);
                }
            }
        } catch (err) {
            console.error('[SMS] Error sending approver confirmation notification:', err);
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
                                email: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter active users
                const leaders = departmentLeaderRoles
                    .filter(ur => !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name }));

                if (leaders.length > 0) {
                    const balance = await getDepartmentApprovedBalance(updatedTransaction.department.id);

                    const currencySymbol = updatedTransaction.currency?.symbol || '$';
                    const transactionDescription = updatedTransaction.description || (updatedTransaction.type === 'INCOME' ? 'Income' : 'Expense');
                    const descShort = transactionDescription.substring(0, 30) + (transactionDescription.length > 30 ? '...' : '');
                    const txAmount = formatNumber(moneyToString(updatedTransaction.amount));
                    const balStr = formatNumber(moneyToString(balance));

                    // Generate credit or debit alert based on transaction type
                    let alertMessage: string;
                    if (updatedTransaction.type === 'INCOME') {
                        alertMessage = await generateCreditAlertSms({
                            currency: currencySymbol,
                            amount: txAmount,
                            description: descShort,
                            departmentName: updatedTransaction.department.name,
                            balance: balStr,
                        });
                    } else {
                        alertMessage = await generateDebitAlertSms({
                            currency: currencySymbol,
                            amount: txAmount,
                            description: descShort,
                            departmentName: updatedTransaction.department.name,
                            balance: balStr,
                        });
                    }

                    // Send to all leaders, except the creator who already received the
                    // approval SMS (which carries the same balance) — merges the two
                    // messages a requesting leader would otherwise get into one.
                    for (const leader of leaders) {
                        try {
                            if (leader.phone && leader.phone === creatorNotifiedPhone) {
                                console.log(`[SMS] Skipping ${updatedTransaction.type === 'INCOME' ? 'credit' : 'debit'} alert for ${leader.phone}; already notified via approval SMS`);
                                continue;
                            }
                            if (leader.phone) {
                                console.log(`[SMS] Sending ${updatedTransaction.type === 'INCOME' ? 'credit' : 'debit'} alert to leader: ${leader.phone}`);
                                await sendSms({ to: leader.phone, message: alertMessage }).catch(() => false);
                            }
                        } catch (err) {
                            console.error(`[SMS] Failed to send alert to leader:`, err);
                        }
                    }
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error sending credit/debit alert to leader:', smsError);
            }
        }

        // Calculate final balance for response (exact, in Decimal)
        let newBalance: string | null = null;
        let balanceCurrency: { code: string; symbol: string } | null = null;

        try {
            const balance = await getDepartmentApprovedBalance(updatedTransaction.department.id);
            newBalance = moneyToString(balance);

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
