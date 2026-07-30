import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { hasOrganisationAccess } from '@/lib/organisations';
import { sendSms } from '@/lib/sms';
import { generateTransactionApprovedSms, generateTransactionDeclinedSms, generateTransactionChargeSms, generateCreditAlertSms, generateDebitAlertSms, generateTransactionEditNotificationSms, generateApproverApprovedSms, generateApproverDeclinedSms } from '@/lib/sms-templates';
import { formatNumber, isWeekLocked, getWeekFromDate } from '@/lib/utils';
import { toDecimal, eq, moneyToString, toMoney2dp } from '@/lib/money';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { getAppCurrency } from '@/lib/currency';

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
        const { type, amount, description, organisationId, date } = body;
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

        // Validate organisation access for non-superadmin
        if (session.user.role !== 'SUPERADMIN') {
            const canAccessSource = await hasOrganisationAccess(session.user, existingTransaction.organisationId);
            if (!canAccessSource) {
                return NextResponse.json(
                    { error: 'You do not have access to the transaction\'s current church' },
                    { status: 403 }
                );
            }
            const canAccessDest = await hasOrganisationAccess(session.user, organisationId);
            if (!canAccessDest) {
                return NextResponse.json(
                    { error: 'You do not have access to the destination church' },
                    { status: 403 }
                );
            }
        }

        // GHS only — amountInBase equals amount
        const ghs = await getAppCurrency();
        const amountToPersist = toMoney2dp(toDecimal(amount));

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
                organisationId,
                currencyId: ghs.id,
                exchangeRate: null,
                amountInBase: amountToPersist,
                ...(date ? { createdAt: new Date(date) } : {}),
                ...weekData,
                updatedAt: new Date(),
            },
            include: { organisation: true,
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
                    organisationId: existingTransaction.organisationId,
                    createdAt: existingTransaction.createdAt,
                },
                afterData: { description, type, amount, organisationId, ...(date ? { createdAt: new Date(date) } : {}), locked: existingTransaction.locked },
            },
        });

        // Detect what changed (for SMS notification)
        const amountChanged = !eq(existingTransaction.amount, amount);
        const typeChanged = existingTransaction.type !== type;
        const descriptionChanged = existingTransaction.description !== description;
        const organisationChanged = existingTransaction.organisationId !== organisationId;
        const dateChanged = date ? new Date(date).toDateString() !== new Date(existingTransaction.createdAt).toDateString() : false;

        const nonDateFieldChanged = amountChanged || typeChanged || descriptionChanged || organisationChanged;

        // Send SMS to organisation leaders if anything other than date changed
        if (nonDateFieldChanged) {
            try {
                // Build a human-readable changes summary
                const changesList: string[] = [];
                if (amountChanged) changesList.push(`Amount: ${moneyToString(existingTransaction.amount)} → ${moneyToString(amount)}`);
                if (typeChanged) changesList.push(`Type: ${existingTransaction.type} → ${type}`);
                if (descriptionChanged) changesList.push(`Desc updated`);
                if (organisationChanged) changesList.push(`Dept changed`);
                const changesSummary = changesList.join(', ');

                // Determine the organisation(s) whose leaders need to be notified
                const organisationIds = new Set([existingTransaction.organisationId]);
                if (organisationChanged) organisationIds.add(organisationId);

                for (const deptId of organisationIds) {
                    const dept = await prisma.organisation.findUnique({
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
                        where: { role: leaderRole, organisationId: deptId },
                        include: { user: { select: { phone: true, email: true, name: true, archived: true } } },
                    });

                    const smsMessage = generateTransactionEditNotificationSms({
                        organisationName: dept.name,
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
            include: { organisation: true,
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

        // Check if the admin has access to this organisation
        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            
            const hasAccess = await hasOrganisationAccess(
                { role: session.user.role, organisationId: filterOrganisationId },
                transaction.organisationId
            );

            if (!hasAccess) {
                return new NextResponse('You do not have access to this church', { status: 403 });
            }
        }

        // Update transaction status
        let finalApprovedAmount = transaction.amount;
        if (status === 'APPROVED' && approvedAmount !== undefined) {
            finalApprovedAmount = approvedAmount;
        }

        // If the approver changed the amount, keep the originally requested
        // amount on the record instead of silently overwriting it.
        const amountWasChanged = status === 'APPROVED' && approvedAmount !== undefined && !eq(transaction.amount, approvedAmount);

        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status,
                amount: status === 'APPROVED' && approvedAmount !== undefined ? approvedAmount : transaction.amount,
                requestedAmount: amountWasChanged ? transaction.amount : undefined,
                approvedBy: status === 'APPROVED' ? session.user.id : undefined,
                approvedAt: status === 'APPROVED' ? new Date() : undefined,
                rejectedBy: status === 'REJECTED' ? session.user.id : undefined,
                rejectedAt: status === 'REJECTED' ? new Date() : undefined,
                rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
            },
            include: { organisation: {
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
                    isCharge: true, // System-generated fee, not a receipted expense request
                    amount: toMoney2dp(chargeDec),
                    amountInBase: toMoney2dp(chargeAmountInBaseDec),
                    description: `Transaction charge for: ${transaction.description.substring(0, 50)}${transaction.description.length > 50 ? '...' : ''} - Ref: ${transaction.id.substring(0, 8)}`,
                    organisationId: transaction.organisationId,
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

            // Send SMS notification to the organisation leader about the charge
            try {
                // Find the organisation leader based on organisation level
                const leaderRole = updatedTransaction.organisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  updatedTransaction.organisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                                  updatedTransaction.organisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  updatedTransaction.organisation.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                const organisationLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        organisationId: updatedTransaction.organisation.id,
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
                const leaders = organisationLeaderRoles
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
                        organisationName: transaction.organisation.name,
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

        // Create audit log for the approval/rejection. When the approver
        // changed the amount, record the before/after amounts explicitly so
        // there's a durable trail of who reduced a request and by how much.
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transactionId,
                beforeData: amountWasChanged ? { amount: moneyToString(transaction.amount) } : undefined,
                afterData: {
                    status,
                    approvedBy: status === 'APPROVED' ? session.user.id : undefined,
                    rejectedBy: status === 'REJECTED' ? session.user.id : undefined,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                    ...(amountWasChanged ? { amount: moneyToString(finalApprovedAmount), requestedAmount: moneyToString(transaction.amount) } : {}),
                },
            },
        });

        // Fetch balance once for APPROVED — reused for both creator and approver notifications
        const approvedBalance = status === 'APPROVED'
            ? await getOrganisationApprovedBalance(updatedTransaction.organisation.id)
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
                        organisationName: updatedTransaction.organisation.name,
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
                const deptName = updatedTransaction.organisation.name;
                const amountStr = formatNumber(moneyToString(updatedTransaction.amount));

                if (status === 'APPROVED') {
                    const balStr = formatNumber(moneyToString(approvedBalance!));
                    const chargeText = chargeDec && chargeDec.gt(0)
                        ? ` Charge: ${currencySymbol}${formatNumber(chargeDec.toString())}.`
                        : '';
                    const sms = generateApproverApprovedSms({
                        transactionType, currency: currencySymbol, amount: amountStr,
                        submitterName, organisationName: deptName, balance: balStr, chargeText,
                    });
                    await sendSms({ to: approverUser.phone, message: sms }).catch(() => false);
                } else {
                    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
                    const sms = generateApproverDeclinedSms({
                        transactionType, currency: currencySymbol, amount: amountStr,
                        submitterName, organisationName: deptName, reasonText,
                    });
                    await sendSms({ to: approverUser.phone, message: sms }).catch(() => false);
                }
            }
        } catch (err) {
            console.error('[SMS] Error sending approver confirmation notification:', err);
        }

        // Send credit/debit alert SMS to the organisation leader when approved
        if (status === 'APPROVED') {
            try {
                // Determine the leader role based on organisation level
                const leaderRole = updatedTransaction.organisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  updatedTransaction.organisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                                  updatedTransaction.organisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  updatedTransaction.organisation.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                // Find all users with the leader role for this organisation
                const organisationLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        organisationId: updatedTransaction.organisation.id,
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
                const leaders = organisationLeaderRoles
                    .filter(ur => !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name }));

                if (leaders.length > 0) {
                    const balance = await getOrganisationApprovedBalance(updatedTransaction.organisation.id);

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
                            organisationName: updatedTransaction.organisation.name,
                            balance: balStr,
                        });
                    } else {
                        alertMessage = await generateDebitAlertSms({
                            currency: currencySymbol,
                            amount: txAmount,
                            description: descShort,
                            organisationName: updatedTransaction.organisation.name,
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
            const balance = await getOrganisationApprovedBalance(updatedTransaction.organisation.id);
            newBalance = moneyToString(balance);

            // Get currency from organisation's base currency
            const dept = await prisma.organisation.findUnique({
                where: { id: updatedTransaction.organisation.id },
                include: { organisationBaseCurrency: { include: { currency: true } } },
            });
            if (dept?.organisationBaseCurrency?.currency) {
                balanceCurrency = {
                    code: dept.organisationBaseCurrency.currency.code,
                    symbol: dept.organisationBaseCurrency.currency.symbol,
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
