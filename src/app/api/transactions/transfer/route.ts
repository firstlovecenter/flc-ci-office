import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrganisationAccess } from '@/lib/organisations';
import { canAdministerOrganisation } from '@/lib/roles';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { isBankAccount, hasAccountBalance } from '@/lib/org-model';
import { createAuditLog } from '@/lib/audit';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateOrganisationTransferSms } from '@/lib/sms-templates';
import { sendPushNotification } from '@/lib/notifications';
import { APP_CURRENCY } from '@/lib/currency-constants';
import { getCurrentWeek } from '@/lib/utils';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const LEADER_ROLES = ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'] as const;

const fmt = (v: unknown) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Move funds between two bank accounts.
 *
 * Transfers post immediately — they are an administrative reallocation between
 * accounts the caller already controls, not a spending request, so they do not
 * enter the approval queue and are not bound by the expense window (that window
 * governs leaders submitting withdrawals).
 *
 * Both legs are written in a single database transaction: a transfer can never
 * exist half-posted. They share a `transferId` so the pair is provable, and the
 * whole movement produces one TRANSFER audit entry in addition to the per-row
 * transaction records.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    if (!canAdministerOrganisation(session.user.role)) {
        return NextResponse.json(
            { error: 'Only managers can transfer funds between accounts' },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const { fromAccountId, toAccountId, amount, reason } = body as {
            fromAccountId?: string; toAccountId?: string; amount?: number | string; reason?: string;
        };

        if (!fromAccountId || !toAccountId) {
            return NextResponse.json({ error: 'Both a source and destination account are required' }, { status: 400 });
        }
        if (fromAccountId === toAccountId) {
            return NextResponse.json({ error: 'Source and destination must be different accounts' }, { status: 400 });
        }
        if (!reason || !reason.trim()) {
            return NextResponse.json({ error: 'A reason is required for every transfer' }, { status: 400 });
        }

        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return NextResponse.json({ error: 'Enter a transfer amount greater than zero' }, { status: 400 });
        }
        // Money is stored at 2dp; reject anything finer rather than rounding silently.
        if (Math.round(value * 100) !== Number((value * 100).toFixed(4))) {
            return NextResponse.json({ error: 'Amount cannot have more than 2 decimal places' }, { status: 400 });
        }
        const cents = Math.round(value * 100);

        const [from, to] = await Promise.all([
            prisma.organisation.findUnique({
                where: { id: fromAccountId },
                include: { userRoles: { where: { role: { in: [...LEADER_ROLES] } }, include: { user: true } } },
            }),
            prisma.organisation.findUnique({
                where: { id: toAccountId },
                include: { userRoles: { where: { role: { in: [...LEADER_ROLES] } }, include: { user: true } } },
            }),
        ]);

        if (!from || !to) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        if (!from.isActive || !to.isActive) {
            return NextResponse.json({ error: 'Cannot transfer to or from a closed account' }, { status: 400 });
        }
        if (!isBankAccount(from.level) || !isBankAccount(to.level)) {
            return NextResponse.json({ error: 'Transfers are only possible between bank accounts' }, { status: 400 });
        }
        // SPECIAL_PROJECT accounts hold no balance and cannot receive deposits.
        if (!hasAccountBalance(from.accountType)) {
            return NextResponse.json({ error: `${from.name} does not hold a balance and cannot be a transfer source` }, { status: 400 });
        }
        if (!hasAccountBalance(to.accountType)) {
            return NextResponse.json({ error: `${to.name} does not hold a balance and cannot receive transfers` }, { status: 400 });
        }

        // The caller must control BOTH ends — scope over one does not authorise
        // moving money into or out of the other.
        const scopeId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        const [canFrom, canTo] = await Promise.all([
            hasOrganisationAccess({ role: session.user.role, organisationId: scopeId }, fromAccountId),
            hasOrganisationAccess({ role: session.user.role, organisationId: scopeId }, toAccountId),
        ]);
        if (!canFrom || !canTo) {
            return NextResponse.json(
                { error: 'You do not have permission over both accounts in this transfer' },
                { status: 403 }
            );
        }

        const sourceBalance = await getOrganisationApprovedBalance(fromAccountId);
        const availableCents = Math.round(Number(sourceBalance) * 100);
        if (availableCents < cents) {
            return NextResponse.json(
                { error: `Insufficient balance. ${from.name} holds ${APP_CURRENCY.symbol}${fmt(sourceBalance)}` },
                { status: 400 }
            );
        }

        const now = new Date();
        const transferId = crypto.randomUUID();
        const label = reason.trim();
        const { weekNumber, year } = getCurrentWeek();

        const base = {
            amount: value,
            amountInBase: value,
            description: `TRANSFER: ${label}`,
            status: 'APPROVED' as const,
            userId: session.user.id,
            approvedAt: now,
            approvedBy: session.user.id,
            weekNumber,
            year,
            transferId,
            updatedAt: now,
        };

        // One database transaction: both legs land, or neither does.
        const [debit, credit] = await prisma.$transaction([
            prisma.transaction.create({
                data: { ...base, id: crypto.randomUUID(), organisationId: fromAccountId, type: 'EXPENSE', transferDirection: 'OUT' },
            }),
            prisma.transaction.create({
                data: { ...base, id: crypto.randomUUID(), organisationId: toAccountId, type: 'INCOME', transferDirection: 'IN' },
            }),
        ]);

        const [fromBalance, toBalance] = await Promise.all([
            getOrganisationApprovedBalance(fromAccountId),
            getOrganisationApprovedBalance(toAccountId),
        ]);

        await createAuditLog({
            userId: session.user.id,
            actionType: 'TRANSFER',
            entityType: 'Transaction',
            entityId: transferId,
            afterData: {
                transferId,
                amount: value,
                from: { id: from.id, name: from.name, balanceAfter: Number(fromBalance) },
                to: { id: to.id, name: to.name, balanceAfter: Number(toBalance) },
                reason: label,
                legs: { debit: debit.id, credit: credit.id },
            },
            description: `Transferred ${APP_CURRENCY.symbol}${fmt(value)} from ${from.name} to ${to.name}. Reason: ${label}`,
            metadata: { transferId, fromAccountId, toAccountId },
        });

        // Notify both account holders. Never let a delivery failure roll back a
        // posted transfer — the money has already moved.
        const notify = async (
            org: typeof from,
            balanceAfter: unknown,
            transactionType: 'INCOME' | 'EXPENSE',
        ) => {
            const holder = org.userRoles[0]?.user;
            if (!holder) return;
            const message = generateOrganisationTransferSms({
                transactionType,
                currency: APP_CURRENCY.symbol,
                amount: fmt(value),
                fromOrganisation: from.name,
                toOrganisation: to.name,
                reason: label,
                balance: fmt(balanceAfter),
            });
            if (holder.phone) {
                try { await sendSms({ to: formatGhanaPhone(holder.phone), message }); } catch { /* delivery is best-effort */ }
            }
            // Push is currently a no-op (the PushSubscription model is not in the
            // schema yet) but wiring it here means transfers light up with the
            // rest of the app the moment it is re-enabled.
            try {
                await sendPushNotification([holder.id], {
                    title: transactionType === 'EXPENSE' ? 'Funds transferred out' : 'Funds received',
                    body: message,
                    url: '/transactions',
                });
            } catch { /* delivery is best-effort */ }
        };

        await Promise.allSettled([
            notify(from, fromBalance, 'EXPENSE'),
            notify(to, toBalance, 'INCOME'),
        ]);

        return NextResponse.json({
            transferId,
            amount: value,
            from: { id: from.id, name: from.name, newBalance: Number(fromBalance) },
            to: { id: to.id, name: to.name, newBalance: Number(toBalance) },
        });
    } catch (error) {
        console.error('[transfer] failed:', error);
        return NextResponse.json({ error: 'Failed to complete transfer' }, { status: 500 });
    }
}
