import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditActorId } from '@/lib/audit-actor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { toDecimal, moneyToString, toMoney2dp } from '@/lib/money';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { sendSms } from '@/lib/sms';
import { generateCorrectionNotificationSms, generateOrganisationTransferSms, generateAdminTransactionAlertSms } from '@/lib/sms-templates';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { hasOrganisationAccess } from '@/lib/organisations';
import { assertMoneyBearingOrganisation } from '@/lib/org-model';
import { parsePositiveAmount } from '@/lib/amount-validation';
import { canWriteToLockedWeek, LOCKED_WEEK_ERROR } from '@/lib/period-lock';
import { isWeekLocked } from '@/lib/utils';

class CorrectionConflictError extends Error {}


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
                currency: true,
            },
        });

        if (!originalTransaction) {
            return NextResponse.json(
                { error: 'Original transaction not found' },
                { status: 404 }
            );
        }

        // Scope: a non-super admin may only correct inside their own subtree —
        // both the transaction's organisation and any destination. Checked
        // before anything is written.
        if (session.user.role !== 'SUPERADMIN') {
            const scopeUser = {
                role: session.user.role,
                organisationId: session.user.activeUserRole?.organisationId || session.user.organisationId,
            };
            const canSource = await hasOrganisationAccess(scopeUser, originalTransaction.organisationId);
            const canDest = isOrganisationChange ? await hasOrganisationAccess(scopeUser, newOrganisationId) : true;
            if (!canSource || !canDest) {
                return NextResponse.json(
                    { error: 'You do not have access to this transaction or destination' },
                    { status: 403 }
                );
            }
        }

        if (originalTransaction.status !== 'APPROVED') {
            return NextResponse.json(
                { error: 'Only approved transactions can be corrected' },
                { status: 400 }
            );
        }
        if (originalTransaction.correctedAt) {
            return NextResponse.json(
                { error: 'This transaction has already been corrected' },
                { status: 409 }
            );
        }
        if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 300)) {
            return NextResponse.json({ error: 'Reason must be at most 300 characters' }, { status: 400 });
        }
        if (isAmountChange) {
            const parsed = parsePositiveAmount(newAmount, 'New amount');
            if (!parsed.ok) {
                return NextResponse.json({ error: parsed.error }, { status: 400 });
            }
        }
        // Correction rows carry the original's week; a closed week needs Oversight+.
        if (
            originalTransaction.weekNumber && originalTransaction.year &&
            isWeekLocked(originalTransaction.weekNumber, originalTransaction.year) &&
            !canWriteToLockedWeek(session.user.role)
        ) {
            return NextResponse.json({ error: LOCKED_WEEK_ERROR }, { status: 403 });
        }

        // Validate the new organisation if provided: it must be an active,
        // money-bearing account.
        let newOrganisation = null;
        if (isOrganisationChange) {
            newOrganisation = await prisma.organisation.findUnique({
                where: { id: newOrganisationId },
                select: { id: true, name: true, level: true, isActive: true },
            });
            if (!newOrganisation || !newOrganisation.isActive) {
                return NextResponse.json(
                    { error: 'New organisation not found' },
                    { status: 404 }
                );
            }
            const moneyError = assertMoneyBearingOrganisation(newOrganisation.level);
            if (moneyError) {
                return NextResponse.json({ error: moneyError }, { status: 400 });
            }
        }

        // Claim the original exactly once. Runs inside the same DB transaction
        // as the rows it justifies, so a replay or race creates nothing.
        const claimOriginal = async (tx: Prisma.TransactionClient) => {
            const claimed = await tx.transaction.updateMany({
                where: { id: originalTransaction.id, status: 'APPROVED', correctedAt: null },
                data: { correctedAt: new Date() },
            });
            if (claimed.count !== 1) throw new CorrectionConflictError();
        };

        // Calculate the difference using Decimal arithmetic
        const originalAmountDec = toDecimal(originalTransaction.amount);
        const newAmountDec = isAmountChange ? toDecimal(newAmount) : originalAmountDec; // validated above
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
            const reverseDescription = `DEPT TRANSFER: Reversed - moved to ${targetOrganisation.name}. Original: "${originalTransaction.description}". ${reason || 'Church correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const reverseAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? originalAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : originalAmountDec;

            const { reversalTransaction, newTransaction } = await prisma.$transaction(async (tx) => {
            await claimOriginal(tx);
            const reversalTransaction = await tx.transaction.create({
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
            const newDescription = `DEPT TRANSFER: From ${originalTransaction.organisation.name}. Original: "${originalTransaction.description}". ${reason || 'Church correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const newAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? newAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : newAmountDec;

            const newTransaction = await tx.transaction.create({
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

            return { reversalTransaction, newTransaction };
            });

            // Audit logs for both transactions
            await createAuditLog({
                userId: auditActorId(session),
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
                userId: auditActorId(session),
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
                        reason: reason || 'Church correction',
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
                        reason: reason || 'Church correction',
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
                        reason: reason || 'Church correction',
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

        const correctionTransaction = await prisma.$transaction(async (tx) => {
        await claimOriginal(tx);
        return tx.transaction.create({
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
        });

        // Create audit log
        await createAuditLog({
            userId: auditActorId(session),
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
        if (error instanceof CorrectionConflictError) {
            return NextResponse.json(
                { error: 'This transaction has already been corrected' },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create correction transaction' },
            { status: 500 }
        );
    }
}
