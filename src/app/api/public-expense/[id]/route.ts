import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { getCurrentWeek, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generatePendingApprovalRequestSms, generateDebitAlertSms, generatePublicExpenseLeaderApprovedSms, generatePublicExpenseLeaderDeclinedSms } from '@/lib/sms-templates';
import { getDescendantOrganisationIds, getLeaderRoleForLevel } from '@/lib/organisations';
import { toDecimal, gt, isPositive, moneyToString, toMoney2dp } from '@/lib/money';
import { getOrganisationApprovedBalance } from '@/lib/balance';

export const dynamic = 'force-dynamic';

async function resolveCampusAdminOrgId(session: any): Promise<string | undefined> {
    if (session.user.activeUserRole?.role === 'CAMPUS_ADMIN') {
        return session.user.activeUserRole?.organisationId ?? undefined;
    }
    const campusUserRole = await prisma.userRole.findFirst({
        where: { userId: session.user.id, role: 'CAMPUS_ADMIN' },
        select: { organisationId: true },
    });
    return campusUserRole?.organisationId ?? undefined;
}

function hasCampusAdminAccess(session: any): boolean {
    const userRoles = Array.isArray(session.user.roles)
        ? session.user.roles.map((r: string) => (typeof r === 'string' ? r.toUpperCase() : ''))
        : [];
    return (session.user.role || '').toUpperCase() === 'CAMPUS_ADMIN' || userRoles.includes('CAMPUS_ADMIN');
}

// Auth-protected: CAMPUS_ADMIN can process or reject public expense requests
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasCampusAdminAccess(session)) {
        return NextResponse.json({ error: 'Only Campus managers can process public expense requests' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, organisationId } = body;

    if (!['process', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action. Must be "process" or "reject".' }, { status: 400 });
    }

    try {
        const publicRequest = await prisma.publicExpenseRequest.findUnique({
            where: { id },
            include: { campusOrganisation: { select: { id: true, name: true } } },
        });

        if (!publicRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (publicRequest.status !== 'PENDING') {
            return NextResponse.json({ error: 'This request has already been processed.' }, { status: 400 });
        }

        const adminCampusId = await resolveCampusAdminOrgId(session);

        if (!adminCampusId || publicRequest.campusOrganisationId !== adminCampusId) {
            return NextResponse.json({ error: 'You can only process requests for your own campus.' }, { status: 403 });
        }

        if (action === 'reject') {
            await prisma.publicExpenseRequest.update({
                where: { id },
                data: { status: 'REJECTED', updatedAt: new Date() },
            });

            if (publicRequest.leaderPhone) {
                try {
                    const declinedSms = generatePublicExpenseLeaderDeclinedSms({
                        requesterName: publicRequest.requesterName,
                        amount: moneyToString(publicRequest.amount),
                        churchName: publicRequest.churchName,
                    });
                    sendSms({ to: publicRequest.leaderPhone, message: declinedSms }).catch((err) => {
                        console.error('[Notify] Declined SMS to leader failed:', err?.message || err);
                    });
                } catch (err) {
                    console.error('[Notify] Error sending declined SMS to leader:', err);
                }
            }

            return NextResponse.json({ success: true });
        }

        if (!organisationId) {
            return NextResponse.json({ error: 'An account must be selected to process this request.' }, { status: 400 });
        }

        const allowedDeptIds = await getDescendantOrganisationIds(adminCampusId);
        if (!allowedDeptIds.includes(organisationId)) {
            return NextResponse.json({ error: 'Selected account is not within your campus.' }, { status: 403 });
        }

        const selectedOrg = await prisma.organisation.findUnique({
            where: { id: organisationId },
            select: { level: true },
        });
        if (selectedOrg?.level !== 'COUNCIL') {
            return NextResponse.json({ error: 'Public requests must be processed against a bank account.' }, { status: 400 });
        }

        const balance = await getOrganisationApprovedBalance(organisationId);
        const requestAmountDec = toDecimal(publicRequest.amount);

        if (!isPositive(balance)) {
            return NextResponse.json(
                { error: 'The selected account does not have a positive balance. Withdrawals cannot be made without a positive balance.' },
                { status: 400 }
            );
        }

        if (gt(requestAmountDec, balance)) {
            return NextResponse.json(
                { error: `Insufficient balance. The available balance is ${formatNumber(moneyToString(balance))}. The request amount is ${formatNumber(moneyToString(requestAmountDec))}.` },
                { status: 400 }
            );
        }

        const description = `Public Request — Requester: ${publicRequest.requesterName} | Church: ${publicRequest.churchName} | Momo: ${publicRequest.momoName} (${publicRequest.momoNumber}) | ${publicRequest.description}`;

        const { weekNumber, year } = getCurrentWeek();

        const transaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type: 'EXPENSE',
                amount: toMoney2dp(publicRequest.amount),
                amountInBase: toMoney2dp(publicRequest.amount),
                description,
                organisationId,
                userId: session.user.id,
                weekNumber,
                year,
                locked: false,
                status: 'PENDING',
                updatedAt: new Date(),
            },
            include: { organisation: { select: { id: true, name: true, level: true } },
                currency: true,
            },
        });

        await prisma.publicExpenseRequest.update({
            where: { id },
            data: {
                status: 'PROCESSED',
                transactionId: transaction.id,
                updatedAt: new Date(),
            },
        });

        if (publicRequest.leaderPhone) {
            try {
                const approvedSms = generatePublicExpenseLeaderApprovedSms({
                    requesterName: publicRequest.requesterName,
                    amount: moneyToString(publicRequest.amount),
                    churchName: publicRequest.churchName,
                });
                sendSms({ to: publicRequest.leaderPhone, message: approvedSms }).catch((err) => {
                    console.error('[Notify] Approved SMS to leader failed:', err?.message || err);
                });
            } catch (err) {
                console.error('[Notify] Error sending approved SMS to leader:', err);
            }
        }

        try {
            const deptLevel = transaction.organisation?.level;
            if (deptLevel) {
                const leaderRole = getLeaderRoleForLevel(deptLevel as any);
                const leaderUserRole = await prisma.userRole.findFirst({
                    where: { role: leaderRole, organisationId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });
                if (leaderUserRole && !leaderUserRole.user.archived && leaderUserRole.user.phone) {
                    const remainingBalance = balance.minus(requestAmountDec);
                    const ref = `${publicRequest.requesterName}, ${publicRequest.churchName}: ${publicRequest.description}`;
                    const leaderSms = generateDebitAlertSms({
                        currency: 'GH\u20B5',
                        amount: formatNumber(moneyToString(requestAmountDec)),
                        organisationName: transaction.organisation?.name || 'your church',
                        description: ref,
                        balance: formatNumber(moneyToString(remainingBalance)),
                    });
                    sendSms({ to: leaderUserRole.user.phone, message: leaderSms }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Notify] SMS to organisation leader failed:', err);
        }

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                afterData: transaction as any,
                description: `Created from public expense request ${id}`,
            },
        });

        try {
            const campusAdminRoles = await prisma.userRole.findMany({
                where: { role: 'CAMPUS_ADMIN', organisationId: adminCampusId },
                include: {
                    user: { select: { phone: true, email: true, name: true, archived: true } },
                },
            });

            const campusAdmins = campusAdminRoles
                .filter(ur => !ur.user.archived && ur.userId !== session.user.id)
                .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                    if (!acc.find(a => a.email === ur.user.email)) {
                        acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                    }
                    return acc;
                }, []);

            if (campusAdmins.length > 0) {
                const smsMessage = generatePendingApprovalRequestSms({
                    userName: session.user.name || 'Campus manager',
                    transactionType: 'expense',
                    currency: '',
                    amount: formatNumber(moneyToString(requestAmountDec)),
                    description,
                });

                for (const admin of campusAdmins) {
                    try {
                        if (admin.phone) {
                            sendSms({ to: admin.phone, message: smsMessage }).catch(() => {});
                        }
                    } catch (err) {
                        console.error('[Notify] Error notifying campus admin:', err);
                    }
                }
            }
        } catch (notifyError) {
            console.error('[Notify] Error in campus admin notification:', notifyError);
        }

        return NextResponse.json({ success: true, transactionId: transaction.id });
    } catch (error) {
        console.error('[PublicExpense] Error processing request:', error);
        return NextResponse.json({ error: 'Failed to process request. Please try again.' }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    if (!hasCampusAdminAccess(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    try {
        const publicRequest = await prisma.publicExpenseRequest.findUnique({
            where: { id },
        });

        if (!publicRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const adminCampusId = await resolveCampusAdminOrgId(session);

        if (!adminCampusId || publicRequest.campusOrganisationId !== adminCampusId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(publicRequest);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
    }
}
