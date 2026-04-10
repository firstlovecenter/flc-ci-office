import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { getCurrentWeek, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { sendEmail } from '@/lib/email';
import { generatePendingApprovalRequestSms, generateDebitAlertSms } from '@/lib/sms-templates';
import { generatePendingApprovalEmail } from '@/lib/email-templates';
import { getDescendantDepartmentIds, getLeaderRoleForLevel } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// Auth-protected: OVERSIGHT_ADMIN can process or reject public expense requests
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userRoles = Array.isArray(session.user.roles)
        ? session.user.roles.map(r => (typeof r === 'string' ? r.toUpperCase() : ''))
        : [];
    const isOversightAdmin =
        (session.user.role || '').toUpperCase() === 'OVERSIGHT_ADMIN' ||
        userRoles.includes('OVERSIGHT_ADMIN');

    if (!isOversightAdmin) {
        return NextResponse.json({ error: 'Only Oversight Admins can process public expense requests' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, departmentId } = body;

    if (!['process', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action. Must be "process" or "reject".' }, { status: 400 });
    }

    try {
        // Fetch the public request
        const publicRequest = await prisma.publicExpenseRequest.findUnique({
            where: { id },
            include: { oversightDept: { select: { id: true, name: true } } },
        });

        if (!publicRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (publicRequest.status !== 'PENDING') {
            return NextResponse.json({ error: 'This request has already been processed.' }, { status: 400 });
        }

        // Resolve the oversight department.
        // If the active role is OVERSIGHT_ADMIN use its departmentId; otherwise look it up.
        let adminOversightDeptId: string | undefined =
            (session.user.activeUserRole as any)?.role === 'OVERSIGHT_ADMIN'
                ? session.user.activeUserRole?.departmentId
                : undefined;

        if (!adminOversightDeptId) {
            const oversightUserRole = await prisma.userRole.findFirst({
                where: { userId: session.user.id, role: 'OVERSIGHT_ADMIN' },
                select: { departmentId: true },
            });
            adminOversightDeptId = oversightUserRole?.departmentId ?? undefined;
        }

        if (!adminOversightDeptId || publicRequest.oversightDeptId !== adminOversightDeptId) {
            return NextResponse.json({ error: 'You can only process requests for your own oversight church.' }, { status: 403 });
        }

        if (action === 'reject') {
            await prisma.publicExpenseRequest.update({
                where: { id },
                data: { status: 'REJECTED', updatedAt: new Date() },
            });

            return NextResponse.json({ success: true });
        }

        // action === 'process'
        if (!departmentId) {
            return NextResponse.json({ error: 'A department/church account must be selected to process this request.' }, { status: 400 });
        }

        // Verify the selected department is within this oversight's hierarchy
        const allowedDeptIds = await getDescendantDepartmentIds(adminOversightDeptId);
        if (!allowedDeptIds.includes(departmentId)) {
            return NextResponse.json({ error: 'Selected department is not within your oversight hierarchy.' }, { status: 403 });
        }

        // Check that the selected department has sufficient balance
        const deptTransactions = await prisma.transaction.findMany({
            where: { departmentId, status: 'APPROVED' },
            select: { type: true, amountInBase: true, amount: true },
        });

        const balance = deptTransactions.reduce((sum, tx) => {
            const txAmount = Number(tx.amountInBase || tx.amount);
            return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
        }, 0);

        const requestAmount = Number(publicRequest.amount);

        if (balance <= 0) {
            return NextResponse.json(
                { error: 'The selected church does not have a positive balance. Expense requests cannot be made for churches without a positive balance.' },
                { status: 400 }
            );
        }

        if (requestAmount > balance) {
            return NextResponse.json(
                { error: `Insufficient balance. The available balance is ${formatNumber(balance)}. The request amount is ${formatNumber(requestAmount)}.` },
                { status: 400 }
            );
        }

        // Build the transaction description using the public request details
        const description = `Public Request — Requester: ${publicRequest.requesterName} | Church: ${publicRequest.churchName} | Momo: ${publicRequest.momoName} (${publicRequest.momoNumber}) | ${publicRequest.description}`;

        const { weekNumber, year } = getCurrentWeek();

        // Create the formal EXPENSE transaction attributed to the oversight admin
        const transaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type: 'EXPENSE',
                amount: publicRequest.amount,
                amountInBase: publicRequest.amount,
                description,
                departmentId,
                userId: session.user.id,
                weekNumber,
                year,
                locked: false,
                status: 'PENDING', // Leader-created, needs admin approval
                updatedAt: new Date(),
            },
            include: {
                department: { select: { id: true, name: true, level: true } },
                currency: true,
            },
        });

        // Mark the public request as processed
        await prisma.publicExpenseRequest.update({
            where: { id },
            data: {
                status: 'PROCESSED',
                transactionId: transaction.id,
                updatedAt: new Date(),
            },
        });

        // Notify the department leader of the deduction and remaining balance
        try {
            const deptLevel = transaction.department?.level;
            if (deptLevel) {
                const leaderRole = getLeaderRoleForLevel(deptLevel as any);
                const leaderUserRole = await prisma.userRole.findFirst({
                    where: { role: leaderRole, departmentId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });
                if (leaderUserRole && !leaderUserRole.user.archived && leaderUserRole.user.phone) {
                    const remainingBalance = balance - requestAmount;
                    const ref = `${publicRequest.requesterName}, ${publicRequest.churchName}: ${publicRequest.description}`;
                    const leaderSms = generateDebitAlertSms({
                        currency: 'GH\u20B5',
                        amount: formatNumber(requestAmount),
                        departmentName: transaction.department?.name || 'your department',
                        description: ref,
                        balance: formatNumber(remainingBalance),
                    });
                    sendSms({ to: leaderUserRole.user.phone, message: leaderSms }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Notify] SMS to department leader failed:', err);
        }

        // Audit log
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

        // Notify campus admins that a pending transaction needs approval
        try {
            const dept = await prisma.department.findUnique({
                where: { id: departmentId },
                include: {
                    parent: {
                        include: {
                            parent: { include: { parent: true } },
                        },
                    },
                },
            });

            const departmentHierarchy: string[] = [];
            if (dept) {
                departmentHierarchy.push(dept.id);
                let current: any = dept.parent;
                while (current) {
                    departmentHierarchy.push(current.id);
                    if (current.level === 'CAMPUS') break;
                    current = current.parent;
                }
            }

            const campusAdminRoles = await prisma.userRole.findMany({
                where: { role: 'CAMPUS_ADMIN', departmentId: { in: departmentHierarchy } },
                include: {
                    user: { select: { phone: true, email: true, name: true, archived: true } },
                },
            });

            const campusAdmins = campusAdminRoles
                .filter(ur => !ur.user.archived)
                .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                    if (!acc.find(a => a.email === ur.user.email)) {
                        acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                    }
                    return acc;
                }, []);

            if (campusAdmins.length > 0) {
                const smsMessage = generatePendingApprovalRequestSms({
                    userName: session.user.name || 'Oversight Admin',
                    transactionType: 'expense',
                    currency: '',
                    amount: formatNumber(requestAmount),
                    description,
                });

                for (const admin of campusAdmins) {
                    try {
                        if (admin.phone) {
                            sendSms({ to: admin.phone, message: smsMessage }).catch(() => {});
                        }
                        const { subject, html } = generatePendingApprovalEmail({
                            adminName: admin.name || 'Admin',
                            submittedBy: session.user.name || 'Oversight Admin',
                            transactionType: 'expense',
                            currency: '',
                            amount: formatNumber(requestAmount),
                            description,
                            departmentName: transaction.department?.name,
                        });
                        sendEmail({ to: admin.email, subject, html }).catch(() => {});
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

// Get a single public expense request (for the oversight admin)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const getRouteRoles = Array.isArray(session.user.roles)
        ? session.user.roles.map(r => (typeof r === 'string' ? r.toUpperCase() : ''))
        : [];
    const getIsOversightAdmin =
        (session.user.role || '').toUpperCase() === 'OVERSIGHT_ADMIN' ||
        getRouteRoles.includes('OVERSIGHT_ADMIN');

    if (!getIsOversightAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    try {
        const publicRequest = await prisma.publicExpenseRequest.findUnique({
            where: { id },
        });

        if (!publicRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Resolve the oversight department for this admin
        let adminOversightDeptId: string | undefined =
            (session.user.activeUserRole as any)?.role === 'OVERSIGHT_ADMIN'
                ? session.user.activeUserRole?.departmentId
                : undefined;

        if (!adminOversightDeptId) {
            const oversightUserRole = await prisma.userRole.findFirst({
                where: { userId: session.user.id, role: 'OVERSIGHT_ADMIN' },
                select: { departmentId: true },
            });
            adminOversightDeptId = oversightUserRole?.departmentId ?? undefined;
        }

        if (!adminOversightDeptId || publicRequest.oversightDeptId !== adminOversightDeptId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(publicRequest);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
    }
}
