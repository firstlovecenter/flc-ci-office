import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { toDecimal, moneyToString, toMoney2dp } from '@/lib/money';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { sendSms } from '@/lib/sms';
import { generateCorrectionNotificationSms, generateOrganisationTransferSms, generateAdminTransactionAlertSms } from '@/lib/sms-templates';
import crypto from 'crypto';

export async function POST(
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
        const { newAmount, reason, newOrganisationId } = body;
        const originalTransactionId = params.id;

        // Determine if this is a organisation change, amount change, or both
        const isOrganisationChange = newOrganisationId && newOrganisationId !== '';
        const isAmountChange = newAmount !== undefined && newAmount !== null;

        // Only admins can create corrections
        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Only admins can create transaction corrections' },
                { status: 403 }
            );
        }

        // Get the original transaction
        const originalTransaction = await prisma.transaction.findUnique({
            where: { id: originalTransactionId },
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
                currency: true,
            },
        });

        if (!originalTransaction) {
            return NextResponse.json(
                { error: 'Original transaction not found' },
                { status: 404 }
            );
        }

        // Validate the new organisation if provided
        let newOrganisation = null;
        if (isOrganisationChange) {
            newOrganisation = await prisma.organisation.findUnique({
                where: { id: newOrganisationId },
                select: { id: true, name: true, level: true },
            });
            if (!newOrganisation) {
                return NextResponse.json(
                    { error: 'New organisation not found' },
                    { status: 404 }
                );
            }
        }

        // Calculate the difference using Decimal arithmetic
        const originalAmountDec = toDecimal(originalTransaction.amount);
        const newAmountDec = isAmountChange ? toDecimal(newAmount) : originalAmountDec;
        const correctionAmountDec = newAmountDec.minus(originalAmountDec);
        const originalAmount = moneyToString(originalAmountDec);
        const newAmountValue = moneyToString(newAmountDec);

        if (correctionAmountDec.eq(0) && !isOrganisationChange) {
            return NextResponse.json(
                { error: 'No changes detected. Please change the amount or organisation.' },
                { status: 400 }
            );
        }

        const targetOrganisationId = isOrganisationChange ? newOrganisationId : originalTransaction.organisationId;
        const targetOrganisation = isOrganisationChange ? newOrganisation! : originalTransaction.organisation;

        // Amount-only correction (no organisation change)
        // Handle organisation change: reverse from old organisation, create in new organisation
        if (isOrganisationChange) {
            // Step 1: Reverse the original transaction in the old organisation
            const reverseType = originalTransaction.type === 'INCOME' ? 'EXPENSE' : 'INCOME';
            const reverseDescription = `DEPT TRANSFER: Reversed - moved to ${targetOrganisation.name}. Original: "${originalTransaction.description}". ${reason || 'Organisation correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const reverseAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? originalAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : originalAmountDec;

            const reversalTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: reverseType,
                    amount: toMoney2dp(originalAmountDec),
                    amountInBase: toMoney2dp(reverseAmountInBaseDec),
                    description: reverseDescription,
                    organisationId: originalTransaction.organisationId,
                    userId: session.user.id,
                    currencyId: originalTransaction.currencyId,
                    exchangeRate: originalTransaction.exchangeRate,
                    status: 'APPROVED',
                    approvedBy: session.user.id,
                    approvedAt: new Date(),
                    locked: false,
                    weekNumber: originalTransaction.weekNumber,
                    year: originalTransaction.year,
                    updatedAt: new Date(),
                },
                include: { organisation: { select: { id: true, name: true, level: true } },
                    currency: true,
                },
            });

            // Step 2: Create the transaction in the new organisation with the (possibly new) amount
            const newDescription = `DEPT TRANSFER: From ${originalTransaction.organisation.name}. Original: "${originalTransaction.description}". ${reason || 'Organisation correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const newAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? newAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : newAmountDec;

            const newTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: originalTransaction.type,
                    amount: toMoney2dp(newAmountDec),
                    amountInBase: toMoney2dp(newAmountInBaseDec),
                    description: newDescription,
                    organisationId: targetOrganisationId,
                    userId: session.user.id,
                    currencyId: originalTransaction.currencyId,
                    exchangeRate: originalTransaction.exchangeRate,
                    status: 'APPROVED',
                    approvedBy: session.user.id,
                    approvedAt: new Date(),
                    locked: false,
                    weekNumber: originalTransaction.weekNumber,
                    year: originalTransaction.year,
                    updatedAt: new Date(),
                },
                include: { organisation: { select: { id: true, name: true, level: true } },
                    currency: true,
                },
            });

            // Audit logs for both transactions
            await createAuditLog({
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: reversalTransaction.id,
                description: `Reversed transaction ${originalTransaction.id} for organisation transfer to ${targetOrganisation.name}`,
                beforeData: null,
                afterData: reversalTransaction as any,
                metadata: {
                    originalTransactionId: originalTransaction.id,
                    transferTo: targetOrganisationId,
                    reason,
                },
                severity: 'HIGH',
            });

            await createAuditLog({
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: newTransaction.id,
                description: `Created transfer transaction from ${originalTransaction.organisation.name} to ${targetOrganisation.name}`,
                beforeData: null,
                afterData: newTransaction as any,
                metadata: {
                    originalTransactionId: originalTransaction.id,
                    transferFrom: originalTransaction.organisationId,
                    originalAmount,
                    newAmount: newAmountValue,
                    reason,
                },
                severity: 'HIGH',
            });

            // Track phones already notified so the acting admin doesn't receive a
            // duplicate message when they are also one of the organisation leaders.
            const notifiedPhones = new Set<string>();

            // Send SMS to old organisation leader
            try {
                const oldLeaderRole = originalTransaction.organisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                    originalTransaction.organisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                    originalTransaction.organisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                    originalTransaction.organisation.level === 'STREAM' ? 'STREAM_LEADER' :
                    'COUNCIL_LEADER';

                const oldLeaders = await prisma.userRole.findMany({
                    where: { role: oldLeaderRole, organisationId: originalTransaction.organisationId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });

                const oldBalance = await getOrganisationApprovedBalance(originalTransaction.organisationId);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of oldLeaders.filter(ur => !ur.user.archived)) {
                    const sms = generateOrganisationTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(originalAmount),
                        fromOrganisation: originalTransaction.organisation.name,
                        toOrganisation: targetOrganisation.name,
                        reason: reason || 'Organisation correction',
                        balance: formatNumber(moneyToString(oldBalance)),
                    });
                    if (lr.user.phone) {
                        await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
                        notifiedPhones.add(lr.user.phone);
                    }
                }
            } catch (e) { /* Don't fail on SMS */ }

            // Send SMS to new organisation leader
            try {
                const newLeaderRole = targetOrganisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                    targetOrganisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                    targetOrganisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                    targetOrganisation.level === 'STREAM' ? 'STREAM_LEADER' :
                    'COUNCIL_LEADER';

                const newLeaders = await prisma.userRole.findMany({
                    where: { role: newLeaderRole, organisationId: targetOrganisationId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });

                const newBalance = await getOrganisationApprovedBalance(targetOrganisationId);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of newLeaders.filter(ur => !ur.user.archived)) {
                    const sms = generateOrganisationTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(newAmountValue),
                        fromOrganisation: originalTransaction.organisation.name,
                        toOrganisation: targetOrganisation.name,
                        reason: reason || 'Organisation correction',
                        balance: formatNumber(moneyToString(newBalance)),
                    });
                    if (lr.user.phone) {
                        await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
                        notifiedPhones.add(lr.user.phone);
                    }
                }
            } catch (e) { /* Don't fail on SMS */ }

            // Confirmation to the admin who performed the transfer
            try {
                const actingAdmin = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { phone: true },
                });
                if (actingAdmin?.phone && !notifiedPhones.has(actingAdmin.phone)) {
                    const adminBalance = await getOrganisationApprovedBalance(targetOrganisationId);
                    const currencySymbol = originalTransaction.currency?.symbol || '$';
                    const sms = generateOrganisationTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(newAmountValue),
                        fromOrganisation: originalTransaction.organisation.name,
                        toOrganisation: targetOrganisation.name,
                        reason: reason || 'Organisation correction',
                        balance: formatNumber(moneyToString(adminBalance)),
                    });
                    await sendSms({ to: actingAdmin.phone, message: sms }).catch(() => {});
                }
            } catch (e) { /* Don't fail on SMS */ }

            return NextResponse.json({
                success: true,
                originalTransaction,
                reversalTransaction,
                newTransaction,
                message: `Transaction transferred from ${originalTransaction.organisation.name} to ${targetOrganisation.name}${!correctionAmountDec.eq(0) ? ` with amount adjusted to ${formatCurrency(newAmountValue, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}` : ''}.`,
            });
        }
        // For EXPENSE: if new < original, we need to CREDIT back (INCOME)
        // For EXPENSE: if new > original, we need to DEBIT more (EXPENSE)
        // For INCOME: if new < original, we need to DEBIT back (EXPENSE)
        // For INCOME: if new > original, we need to CREDIT more (INCOME)
        
        // Simply: same type if correction is positive, opposite if negative
        const correctionType = correctionAmountDec.gt(0)
            ? originalTransaction.type
            : (originalTransaction.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE');
        const absoluteCorrectionDec = correctionAmountDec.abs();
        const absoluteCorrectionAmount = moneyToString(absoluteCorrectionDec);

        // Calculate correction amount in base currency (Decimal arithmetic)
        const correctionAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
            ? absoluteCorrectionDec.mul(toDecimal(originalTransaction.exchangeRate))
            : absoluteCorrectionDec;

        // Create the correction transaction
        const correctionDescription = `CORRECTION: ${reason || 'Amount adjustment'} (Original: ${formatCurrency(originalAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)} → New: ${formatCurrency(newAmountValue, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}) - Ref: ${originalTransaction.id.substring(0, 8)}`;

        const correctionTransaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type: correctionType,
                amount: toMoney2dp(absoluteCorrectionDec),
                amountInBase: toMoney2dp(correctionAmountInBaseDec),
                description: correctionDescription,
                organisationId: originalTransaction.organisationId,
                userId: session.user.id, // Correction created by admin
                currencyId: originalTransaction.currencyId,
                exchangeRate: originalTransaction.exchangeRate,
                status: 'APPROVED', // Auto-approve corrections
                approvedBy: session.user.id,
                approvedAt: new Date(),
                locked: false,
                weekNumber: originalTransaction.weekNumber,
                year: originalTransaction.year,
                updatedAt: new Date(),
            },
            include: { organisation: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                currency: true,
            },
        });

        // Create audit log
        await createAuditLog({
            userId: session.user.id,
            actionType: 'CREATE',
            entityType: 'Transaction',
            entityId: correctionTransaction.id,
            description: `Created correction transaction for ${originalTransaction.id}`,
            beforeData: null,
            afterData: correctionTransaction as any,
            metadata: {
                originalTransactionId: originalTransaction.id,
                originalAmount,
                newAmount: newAmountValue,
                correctionAmount: moneyToString(correctionAmountDec),
                reason,
            },
            severity: 'HIGH',
        });

        // Send SMS notification to the organisation leader (account owner) and a
        // confirmation to the admin who performed the correction.
        try {
            // Find the organisation leader based on organisation level
            const leaderRole = originalTransaction.organisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                              originalTransaction.organisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                              originalTransaction.organisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                              originalTransaction.organisation.level === 'STREAM' ? 'STREAM_LEADER' :
                              'COUNCIL_LEADER';

            const organisationLeaders = await prisma.userRole.findMany({
                where: {
                    role: leaderRole,
                    organisationId: originalTransaction.organisationId,
                },
                include: {
                    user: {
                        select: { phone: true, name: true, archived: true },
                    },
                },
            });

            const activeLeaders = organisationLeaders.filter(ur => !ur.user.archived);

            // Compute balance + formatting once, reused for both the leader alert
            // and the acting-admin confirmation below.
            const balance = await getOrganisationApprovedBalance(originalTransaction.organisationId);
            const currencySymbol = originalTransaction.currency?.symbol || '$';
            const balStr = formatNumber(moneyToString(balance));
            const notifiedPhones = new Set<string>();

            // Alert the account owner(s)
            if (activeLeaders.length > 0) {
                const correctionParams = {
                    transactionType: originalTransaction.type.toLowerCase(),
                    organisationName: originalTransaction.organisation.name,
                    currency: currencySymbol,
                    originalAmount: formatNumber(originalAmount),
                    newAmount: formatNumber(newAmountValue),
                    correctionType: correctionType === 'INCOME' ? 'Credit' : 'Debit',
                    adjustmentAmount: formatNumber(absoluteCorrectionAmount),
                    reason: reason || 'Amount adjustment',
                    balance: balStr,
                };
                const smsMessage = await generateCorrectionNotificationSms(correctionParams);

                for (const lr of activeLeaders) {
                    if (lr.user.phone) {
                        await sendSms({ to: lr.user.phone, message: smsMessage }).catch(() => {});
                        notifiedPhones.add(lr.user.phone);
                    }
                }
            }

            // Confirmation to the admin who performed the correction (credit/debit)
            const actingAdmin = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { phone: true },
            });
            if (actingAdmin?.phone && !notifiedPhones.has(actingAdmin.phone)) {
                const shortReason = (reason || 'Amount adjustment').substring(0, 30);
                const adminMessage = generateAdminTransactionAlertSms({
                    transactionType: correctionType,
                    currency: currencySymbol,
                    amount: formatNumber(absoluteCorrectionAmount),
                    organisationName: originalTransaction.organisation.name,
                    description: `Correction: ${shortReason}`,
                    balance: balStr,
                });
                await sendSms({ to: actingAdmin.phone, message: adminMessage }).catch(() => {});
            }
        } catch (smsError) {
            // Don't fail the request if SMS fails
        }

        return NextResponse.json({
            success: true,
            originalTransaction,
            correctionTransaction,
            message: `Correction transaction created successfully. ${correctionType === 'INCOME' ? 'Credited' : 'Debited'} ${formatCurrency(absoluteCorrectionAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create correction transaction' },
            { status: 500 }
        );
    }
}
