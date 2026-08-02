import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantOrganisationIds, hasOrganisationAccess } from '@/lib/organisations';
import { canAdministerOrganisation } from '@/lib/roles';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { isBankAccount } from '@/lib/org-model';
import { moneyToString, toDecimal, toMoney2dp, type MoneyInput } from '@/lib/money';
import {
    accountClosureBlockers,
    accountClosureWarnings,
    closureTransferDescriptions,
    closureWithdrawalDescription,
    holdsClosingBalance,
    validateClosurePlan,
    validateTransferDestination,
    type ClosureContext,
    type FundsDisposition,
} from '@/lib/account-closure';
import { APP_CURRENCY } from '@/lib/currency-constants';
import { getCurrentWeek } from '@/lib/utils';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateOrganisationTransferSms } from '@/lib/sms-templates';
import crypto from 'crypto';
import type { Prisma, Role } from '@prisma/client';

const LEADER_ROLES: Role[] = ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'];

const fmt = (v: unknown) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Approved balance in minor units, via Decimal so no cent is lost to floats. */
function toMinorUnits(balance: MoneyInput): number {
    return toDecimal(balance).times(100).toDecimalPlaces(0).toNumber();
}

/** Accounts the caller controls and could sweep a closing balance into. */
async function findDestinationOptions(
    scope: { role: string; organisationId?: string | null },
    excludeId: string,
) {
    const where: Prisma.OrganisationWhereInput = {
        level: 'COUNCIL',
        isActive: true,
        accountType: 'OPERATING',
        id: { not: excludeId },
    };

    if (scope.role !== 'SUPERADMIN') {
        if (!scope.organisationId) return [];
        where.id = { in: (await getDescendantOrganisationIds(scope.organisationId)).filter(id => id !== excludeId) };
    }

    const accounts = await prisma.organisation.findMany({
        where,
        select: { id: true, name: true, accountType: true, parent: { select: { name: true } } },
        orderBy: { name: 'asc' },
    });

    return accounts.map(a => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        campusName: a.parent?.name || null,
    }));
}

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
        const organisationId = params.id;
        const body = await request.json().catch(() => ({}));
        const { reason, destinationAccountId } = body as {
            reason?: string; destinationAccountId?: string;
        };
        const disposition = (body?.disposition || 'NONE') as FundsDisposition;

        // Closing is admin-only, and only within the caller's own scope. Scope
        // alone is not enough — `hasOrganisationAccess` is true for a user's own
        // organisation whatever their role, which would let a leader close the
        // church they lead.
        if (!canAdministerOrganisation(session.user.role)) {
            return NextResponse.json(
                { error: 'You do not have permission to close this organisation' },
                { status: 403 }
            );
        }

        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;

        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            organisationId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to close this organisation' },
                { status: 403 }
            );
        }

        // Get the organisation with its children and user roles
        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true },
                    take: 1,
                },
            },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Church not found' }, { status: 404 });
        }

        if (!organisation.isActive) {
            return NextResponse.json({ error: 'Church is already closed' }, { status: 400 });
        }

        // Check for active child organisations
        if (organisation.children.length > 0) {
            return NextResponse.json(
                {
                    error: 'Cannot close organisation with active child organisations',
                    childOrganisations: organisation.children.map(c => c.name),
                },
                { status: 400 }
            );
        }

        const isAccount = isBankAccount(organisation.level);

        // What is left on the account decides what the closure has to post. Read
        // it here rather than trusting the client: the preflight the dialog used
        // may be minutes stale.
        const pendingCount = isAccount
            ? await prisma.transaction.count({ where: { organisationId, status: 'PENDING' } })
            : 0;
        const balance = isAccount
            ? await getOrganisationApprovedBalance(organisationId)
            : toDecimal(0);

        const closureContext: ClosureContext = {
            isAccount,
            accountType: organisation.accountType,
            balanceMinor: toMinorUnits(balance),
            pendingCount,
        };

        const planned = validateClosurePlan(closureContext, { disposition, destinationAccountId });
        if (!planned.ok) {
            return NextResponse.json({ error: planned.error }, { status: 400 });
        }
        const plan = planned.plan;

        // Resolve and authorise the destination before anything is written — a
        // half-swept closure would leave money stranded on a closed account.
        let destination: { id: string; name: string; holderPhone: string | null } | null = null;
        if (plan.disposition === 'TRANSFER' && plan.destinationAccountId) {
            const target = await prisma.organisation.findUnique({
                where: { id: plan.destinationAccountId },
                include: {
                    userRoles: {
                        where: { role: { in: LEADER_ROLES } },
                        include: { user: { select: { id: true, phone: true } } },
                    },
                },
            });

            const valid = validateTransferDestination(organisationId, target);
            if (!valid.ok) {
                return NextResponse.json({ error: valid.error }, { status: 400 });
            }

            const canReceive = await hasOrganisationAccess(
                { role: session.user.role, organisationId: filterOrganisationId },
                plan.destinationAccountId
            );
            if (!canReceive) {
                return NextResponse.json(
                    { error: 'You do not have permission over the destination account' },
                    { status: 403 }
                );
            }

            destination = {
                id: target!.id,
                name: target!.name,
                holderPhone: target!.userRoles[0]?.user.phone ?? null,
            };
        }

        if (plan.disposition === 'TRANSFER' && !destination) {
            return NextResponse.json({ error: 'Destination account not found.' }, { status: 400 });
        }

        // Get users who will lose access (users with roles in this organisation)
        const affectedUsers = organisation.userRoles.map(ur => ({
            id: ur.user.id,
            name: ur.user.name,
            email: ur.user.email,
            role: ur.role,
        }));

        const now = new Date();
        const sweptAmount = toMoney2dp(balance);
        const transferId = plan.disposition === 'TRANSFER' ? crypto.randomUUID() : null;
        const closureNote = reason?.trim() || 'Account closed';

        // Start transaction to dispose of the balance, close the organisation and
        // remove user access. Either the money moves and the account closes, or
        // neither happens.
        await prisma.$transaction(async (tx) => {
            // 0. Post the remaining balance out, so the account closes at zero.
            if (plan.disposition !== 'NONE') {
                const { weekNumber, year } = getCurrentWeek();
                const leg = {
                    amount: sweptAmount,
                    amountInBase: sweptAmount,
                    status: 'APPROVED' as const,
                    userId: session.user.id,
                    approvedAt: now,
                    approvedBy: session.user.id,
                    weekNumber,
                    year,
                    updatedAt: now,
                };

                if (plan.disposition === 'TRANSFER' && destination) {
                    const description = closureTransferDescriptions({
                        sourceName: organisation.name,
                        destinationName: destination.name,
                        note: closureNote,
                    });
                    await tx.transaction.create({
                        data: {
                            ...leg,
                            id: crypto.randomUUID(),
                            organisationId,
                            type: 'EXPENSE',
                            description: description.out,
                            transferId,
                            transferDirection: 'OUT',
                            // A closing sweep is a ledger movement, not a spending
                            // request, so no receipt can ever exist for it.
                            receiptWaived: true,
                            receiptWaivedAt: now,
                            receiptWaivedBy: session.user.id,
                            receiptWaivedReason: 'Balance moved out as part of closing the account',
                        },
                    });
                    await tx.transaction.create({
                        data: {
                            ...leg,
                            id: crypto.randomUUID(),
                            organisationId: destination.id,
                            type: 'INCOME',
                            description: description.in,
                            transferId,
                            transferDirection: 'IN',
                        },
                    });
                } else if (plan.disposition === 'WITHDRAW') {
                    await tx.transaction.create({
                        data: {
                            ...leg,
                            id: crypto.randomUUID(),
                            organisationId,
                            type: 'EXPENSE',
                            description: closureWithdrawalDescription({ sourceName: organisation.name, note: closureNote }),
                            receiptWaived: true,
                            receiptWaivedAt: now,
                            receiptWaivedBy: session.user.id,
                            receiptWaivedReason: 'Balance withdrawn as part of closing the account',
                        },
                    });
                }

                await tx.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        actionType: 'TRANSFER',
                        entityType: 'Transaction',
                        entityId: transferId || organisationId,
                        afterData: {
                            disposition: plan.disposition,
                            amount: sweptAmount,
                            transferId,
                            from: { id: organisationId, name: organisation.name },
                            to: destination ? { id: destination.id, name: destination.name } : null,
                            reason: closureNote,
                        },
                        description: plan.disposition === 'TRANSFER'
                            ? `Transferred closing balance of ${APP_CURRENCY.symbol}${fmt(sweptAmount)} from "${organisation.name}" to "${destination?.name}".`
                            : `Withdrew closing balance of ${APP_CURRENCY.symbol}${fmt(sweptAmount)} from "${organisation.name}".`,
                        severity: 'HIGH',
                        metadata: { closingAccountId: organisationId, transferId, disposition: plan.disposition },
                    },
                });
            }

            // 1. Remove all user roles for this organisation
            const userRolesToRemove = await tx.userRole.findMany({
                where: { organisationId },
            });

            for (const userRole of userRolesToRemove) {
                // Delete the user role
                await tx.userRole.delete({
                    where: { id: userRole.id },
                });

                // Check if this was the user's active role
                const user = await tx.user.findUnique({
                    where: { id: userRole.userId },
                    select: { activeUserRoleId: true },
                });

                if (user?.activeUserRoleId === userRole.id) {
                    // Find another role for this user
                    const remainingRole = await tx.userRole.findFirst({
                        where: { userId: userRole.userId },
                    });

                    if (remainingRole) {
                        // Set the next available role as active
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: remainingRole.id,
                                activeRole: remainingRole.role,
                                organisationId: remainingRole.organisationId,
                            },
                        });
                    } else {
                        // User has no more roles - clear their access
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: null,
                                activeRole: null,
                                organisationId: null,
                            },
                        });
                    }
                }
            }

            // 2. Remove users from being directly assigned to this organisation
            await tx.user.updateMany({
                where: { organisationId },
                data: { organisationId: null },
            });

            // 3. Close the organisation (soft delete)
            await tx.organisation.update({
                where: { id: organisationId },
                data: {
                    isActive: false,
                    closedAt: now,
                    closedBy: session.user.id,
                    closureReason: reason || null,
                },
            });

            // 3b. Mirror the closure onto the BankAccount row. The dual-write
            // trigger only covers Transaction / UserRole / User, so closure state
            // would otherwise diverge between the two tables mid-migration.
            if (isAccount) {
                await tx.bankAccount.updateMany({
                    where: { id: organisationId },
                    data: {
                        isActive: false,
                        closedAt: now,
                        closedBy: session.user.id,
                        closureReason: reason || null,
                        updatedAt: now,
                    },
                });
            }

            // 4. Create audit log
            await tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    actionType: 'DELETE',
                    entityType: isAccount ? 'BankAccount' : 'Organisation',
                    entityId: organisationId,
                    beforeData: {
                        name: organisation.name,
                        level: organisation.level,
                        isActive: true,
                        balance: moneyToString(balance),
                        affectedUsers: affectedUsers,
                    },
                    afterData: {
                        name: organisation.name,
                        level: organisation.level,
                        isActive: false,
                        closedAt: now.toISOString(),
                        closureReason: reason,
                        fundsDisposition: plan.disposition,
                        fundsAmount: plan.disposition === 'NONE' ? null : sweptAmount,
                        fundsDestination: destination ? { id: destination.id, name: destination.name } : null,
                    },
                    description:
                        `Closed ${isAccount ? 'account' : 'organisation'} "${organisation.name}" (${organisation.level}). ` +
                        `${affectedUsers.length} user role(s) removed.` +
                        (plan.disposition === 'TRANSFER'
                            ? ` Remaining ${APP_CURRENCY.symbol}${fmt(sweptAmount)} transferred to "${destination?.name}".`
                            : plan.disposition === 'WITHDRAW'
                                ? ` Remaining ${APP_CURRENCY.symbol}${fmt(sweptAmount)} withdrawn.`
                                : ''),
                    severity: 'HIGH',
                },
            });
        });

        // Tell the receiving holder their account grew. Best-effort only — the
        // money has already moved and a failed SMS must not undo it.
        if (plan.disposition === 'TRANSFER' && destination) {
            if (destination.holderPhone) {
                try {
                    const destinationBalance = await getOrganisationApprovedBalance(destination.id);
                    await sendSms({
                        to: formatGhanaPhone(destination.holderPhone),
                        message: generateOrganisationTransferSms({
                            transactionType: 'INCOME',
                            currency: APP_CURRENCY.symbol,
                            amount: fmt(sweptAmount),
                            fromOrganisation: organisation.name,
                            toOrganisation: destination.name,
                            reason: closureNote,
                            balance: fmt(moneyToString(destinationBalance)),
                        }),
                    });
                } catch { /* delivery is best-effort */ }
            }
        }

        const movedLabel = plan.disposition === 'TRANSFER'
            ? ` ${APP_CURRENCY.symbol}${fmt(sweptAmount)} transferred to ${destination?.name}.`
            : plan.disposition === 'WITHDRAW'
                ? ` ${APP_CURRENCY.symbol}${fmt(sweptAmount)} withdrawn.`
                : '';

        return NextResponse.json({
            success: true,
            message: `${isAccount ? 'Account' : 'Church'} "${organisation.name}" has been closed.${movedLabel}`,
            affectedUsers: affectedUsers.length,
            fundsDisposition: plan.disposition,
            amountMoved: plan.disposition === 'NONE' ? null : sweptAmount,
            destination: destination ? { id: destination.id, name: destination.name } : null,
        });
    } catch (error) {
        console.error('[close] failed:', error);
        return NextResponse.json(
            { error: 'Failed to close organisation' },
            { status: 500 }
        );
    }
}

// GET endpoint to check if organisation can be closed (pre-validation)
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const organisationId = params.id;

        // This preflight returns the names and emails of every user who would
        // lose access, so it needs the same gate as the close itself.
        if (!canAdministerOrganisation(session.user.role)) {
            return NextResponse.json(
                { error: 'You do not have permission to close this organisation' },
                { status: 403 }
            );
        }

        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;

        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            organisationId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to close this organisation' },
                { status: 403 }
            );
        }

        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, level: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true, status: true },
                },
            },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Church not found' }, { status: 404 });
        }

        const isAccount = isBankAccount(organisation.level);

        // Only accounts carry money, so only they need a balance read and a
        // list of accounts the balance could be swept into.
        const balance = isAccount
            ? await getOrganisationApprovedBalance(organisationId)
            : toDecimal(0);
        const destinationOptions = isAccount
            ? await findDestinationOptions(
                { role: session.user.role, organisationId: filterOrganisationId },
                organisationId,
            )
            : [];

        const closureContext: ClosureContext = {
            isAccount,
            accountType: organisation.accountType,
            balanceMinor: toMinorUnits(balance),
            pendingCount: organisation.transactions.filter(t => t.status === 'PENDING').length,
        };

        const warnings: string[] = [];
        const blockers: string[] = [...accountClosureBlockers(closureContext)];

        if (!organisation.isActive) {
            blockers.push('Church is already closed');
        }

        if (organisation.children.length > 0) {
            blockers.push(`Has ${organisation.children.length} active child organisation(s): ${organisation.children.map(c => c.name).join(', ')}`);
        }

        const canClose = organisation.isActive && organisation.children.length === 0 && blockers.length === 0;

        warnings.push(...accountClosureWarnings(closureContext));

        if (organisation.userRoles.length > 0) {
            warnings.push(`${organisation.userRoles.length} user(s) will lose access to this organisation`);
        }

        if (organisation.transactions.length > 0) {
            warnings.push(`${organisation.transactions.length} transaction(s) are associated with this organisation (${closureContext.pendingCount} pending)`);
            warnings.push('Transactions will be preserved for historical records');
        }

        const requiresFundsDisposition = holdsClosingBalance(closureContext);

        return NextResponse.json({
            canClose,
            organisation: {
                id: organisation.id,
                name: organisation.name,
                level: organisation.level,
                accountType: organisation.accountType,
                isActive: organisation.isActive,
            },
            isAccount,
            balance: moneyToString(balance),
            currency: { code: APP_CURRENCY.code, symbol: APP_CURRENCY.symbol },
            requiresFundsDisposition,
            destinationOptions,
            pendingTransactionCount: closureContext.pendingCount,
            affectedUsers: organisation.userRoles.map(ur => ({
                id: ur.user.id,
                name: ur.user.name || ur.user.email,
                role: ur.role,
            })),
            childOrganisations: organisation.children,
            transactionCount: organisation.transactions.length,
            warnings,
            blockers,
        });
    } catch (error) {
        console.error('[close preflight] failed:', error);
        return NextResponse.json(
            { error: 'Failed to check organisation' },
            { status: 500 }
        );
    }
}
