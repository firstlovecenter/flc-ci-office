import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrganisationAccess } from '@/lib/organisations';
import { canReopenAccount } from '@/lib/roles';
import { isBankAccount } from '@/lib/org-model';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Reopen a closed bank account.
 *
 * Campus managers open accounts and close them; only oversight and HQ can undo
 * a closure. Reopening restores a money-bearing account that someone
 * deliberately retired — and closure sweeps the balance out and strips the
 * holder's access, so this is a review of that decision rather than a toggle.
 *
 * The account comes back empty and unheld: the closing sweep is history, and a
 * holder has to be assigned again before anyone can use it.
 */
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

        if (!canReopenAccount(session.user.role)) {
            return NextResponse.json(
                { error: 'Only oversight and HQ managers can reopen a closed account' },
                { status: 403 }
            );
        }

        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: { parent: { select: { id: true, name: true, isActive: true } } },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (!isBankAccount(organisation.level)) {
            return NextResponse.json(
                { error: 'Only accounts can be reopened here' },
                { status: 400 }
            );
        }

        if (organisation.isActive) {
            return NextResponse.json({ error: 'This account is already open' }, { status: 400 });
        }

        // Scope is checked against the campus, not the account: a closed account
        // is excluded from the active-descendant walk `hasOrganisationAccess`
        // performs, so asking about the account itself always answers no.
        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        const campusId = organisation.parentId;

        if (!campusId) {
            return NextResponse.json(
                { error: 'This account has no campus and cannot be reopened. Reattach it to a campus first.' },
                { status: 400 }
            );
        }

        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            campusId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to reopen this account' },
                { status: 403 }
            );
        }

        // An account under a closed campus would be unreachable the moment it
        // reopened, and would not appear in any scope query.
        if (organisation.parent && !organisation.parent.isActive) {
            return NextResponse.json(
                { error: `${organisation.parent.name} is closed. Reopen the campus before reopening its accounts.` },
                { status: 400 }
            );
        }

        const now = new Date();
        const closureSnapshot = {
            closedAt: organisation.closedAt?.toISOString() ?? null,
            closedBy: organisation.closedBy,
            closureReason: organisation.closureReason,
        };

        await prisma.$transaction(async (tx) => {
            await tx.organisation.update({
                where: { id: organisationId },
                data: {
                    isActive: true,
                    closedAt: null,
                    closedBy: null,
                    closureReason: null,
                    updatedAt: now,
                },
            });

            // Mirror onto the BankAccount row — the dual-write trigger covers
            // Transaction / UserRole / User only, so closure state would
            // otherwise diverge between the two tables.
            await tx.bankAccount.updateMany({
                where: { id: organisationId },
                data: {
                    isActive: true,
                    closedAt: null,
                    closedBy: null,
                    closureReason: null,
                    updatedAt: now,
                },
            });

            await tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    actionType: 'RESTORE',
                    entityType: 'BankAccount',
                    entityId: organisationId,
                    beforeData: { name: organisation.name, isActive: false, ...closureSnapshot },
                    afterData: { name: organisation.name, isActive: true, reopenedAt: now.toISOString() },
                    description:
                        `Reopened account "${organisation.name}"` +
                        (organisation.parent ? ` under ${organisation.parent.name}` : '') +
                        '. No holder is assigned until one is set.',
                    severity: 'HIGH',
                    metadata: { campusId },
                },
            });
        });

        return NextResponse.json({
            success: true,
            message: `Account "${organisation.name}" has been reopened. Assign a holder to put it back in use.`,
            account: { id: organisation.id, name: organisation.name },
        });
    } catch (error) {
        console.error('[reopen] failed:', error);
        return NextResponse.json({ error: 'Failed to reopen account' }, { status: 500 });
    }
}
