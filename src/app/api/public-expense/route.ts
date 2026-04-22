import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSms } from '@/lib/sms';
import { sendEmail } from '@/lib/email';
import { generatePublicExpenseRequestSms, generatePublicExpenseLeaderSubmittedSms } from '@/lib/sms-templates';
import { formatTimeInExpenseWindowTimeZone, getExpenseWindowStatus } from '@/lib/expense-window';

export const dynamic = 'force-dynamic';

// Auth-protected GET:
// - OVERSIGHT_ADMIN: requests for own oversight department
// - SUPERADMIN: all public expense requests
// Public POST is below
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const userRoles = Array.isArray(session.user.roles)
        ? session.user.roles.map(role => (typeof role === 'string' ? role.toUpperCase() : ''))
        : [];
    const isOversightAdmin = session.user.role === 'OVERSIGHT_ADMIN' || userRoles.includes('OVERSIGHT_ADMIN');
    const isSuperAdmin = session.user.role === 'SUPERADMIN' || userRoles.includes('SUPERADMIN');

    if (!isOversightAdmin && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve the oversight department for the admin.
    // If the active role is OVERSIGHT_ADMIN, use its departmentId directly.
    // Otherwise (multi-role user with a different active role) look up the
    // OVERSIGHT_ADMIN UserRole record from the database.
    let adminOversightDeptId: string | undefined =
        (session.user.activeUserRole as any)?.role === 'OVERSIGHT_ADMIN'
            ? session.user.activeUserRole?.departmentId
            : undefined;

    if (!adminOversightDeptId && isOversightAdmin) {
        // Active role is not OVERSIGHT_ADMIN — find the right oversight dept from UserRole
        const oversightUserRole = await prisma.userRole.findFirst({
            where: { userId: session.user.id, role: 'OVERSIGHT_ADMIN' },
            select: { departmentId: true },
        });
        adminOversightDeptId = oversightUserRole?.departmentId ?? undefined;
    }

    if (isOversightAdmin && !adminOversightDeptId) {
        return NextResponse.json({ error: 'No oversight department found for your account' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    try {
        const requests = await prisma.publicExpenseRequest.findMany({
            where: {
                ...(isOversightAdmin && adminOversightDeptId ? { oversightDeptId: adminOversightDeptId } : {}),
                ...(status ? { status: status as any } : {}),
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error('[PublicExpense] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

// Public endpoint — no auth required
// Accepts expense requests from members of the public
export async function POST(request: Request) {
    try {
        const expenseWindow = getExpenseWindowStatus();
        if (!expenseWindow.isOpen) {
            return NextResponse.json(
                {
                    error: `Expense requests can only be made between ${expenseWindow.timeRange}. Actual time is ${formatTimeInExpenseWindowTimeZone(expenseWindow.now)}`,
                },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { oversightDeptId, requesterName, leaderPhone, churchName, momoName, momoNumber, amount, description } = body;

        // Validate required fields
        if (!oversightDeptId || !requesterName || !leaderPhone || !churchName || !momoName || !momoNumber || !amount || !description) {
            return NextResponse.json(
                { error: 'All fields are required: oversight church, requester name, leader phone, church name, Momo name, Momo number, amount, and reason.' },
                { status: 400 }
            );
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
        }

        // Verify the oversight department exists and is active
        const oversightDept = await prisma.department.findUnique({
            where: { id: oversightDeptId, level: 'OVERSIGHT', isActive: true },
            select: { id: true, name: true },
        });

        if (!oversightDept) {
            return NextResponse.json({ error: 'Invalid oversight church selected.' }, { status: 400 });
        }

        // Create the public expense request
        const publicRequest = await prisma.publicExpenseRequest.create({
            data: {
                requesterName: requesterName.trim(),
                leaderPhone: leaderPhone.trim(),
                churchName: churchName.trim(),
                momoName: momoName.trim(),
                momoNumber: momoNumber.trim(),
                amount,
                description: description.trim(),
                oversightDeptId,
                updatedAt: new Date(),
            },
        });

        // Send submission confirmation SMS to the leader's phone
        try {
            const submittedSms = generatePublicExpenseLeaderSubmittedSms({
                requesterName: requesterName.trim(),
                amount,
                churchName: churchName.trim(),
            });
            sendSms({ to: leaderPhone.trim(), message: submittedSms }).catch((err) => {
                console.error('[Notify] Submission SMS to leader failed:', err?.message || err);
            });
        } catch (err) {
            console.error('[Notify] Error sending submission SMS to leader:', err);
        }

        // Notify OVERSIGHT_ADMIN(s) of this oversight church
        try {
            const adminRoles = await prisma.userRole.findMany({
                where: {
                    role: 'OVERSIGHT_ADMIN',
                    departmentId: oversightDeptId,
                },
                include: {
                    user: {
                        select: { phone: true, email: true, name: true, archived: true },
                    },
                },
            });

            const admins = adminRoles
                .filter(ur => !ur.user.archived)
                .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                    if (!acc.find(a => a.email === ur.user.email)) {
                        acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                    }
                    return acc;
                }, []);

            const smsMessage = generatePublicExpenseRequestSms({
                requesterName,
                churchName,
                amount,
                momoName,
                momoNumber,
                description,
                oversightDeptName: oversightDept.name,
            });

            for (const admin of admins) {
                try {
                    if (admin.phone) {
                        sendSms({ to: admin.phone, message: smsMessage }).catch((err) => {
                            console.error('[Notify] SMS failed for oversight admin', admin.phone, err?.message || err);
                        });
                    } else {
                        console.warn('[Notify] Oversight admin has no phone number:', admin.email);
                    }
                    sendEmail({
                        to: admin.email,
                        subject: `New Public Expense Request — ${requesterName} (${churchName})`,
                        html: `
                            <p>Dear ${admin.name || 'Oversight Admin'},</p>
                            <p>A new public expense request has been submitted and requires your review.</p>
                            <table style="border-collapse:collapse;width:100%">
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Requester</strong></td><td style="padding:8px;border:1px solid #ddd">${requesterName}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Church</strong></td><td style="padding:8px;border:1px solid #ddd">${churchName}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Momo Name</strong></td><td style="padding:8px;border:1px solid #ddd">${momoName}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Momo Number</strong></td><td style="padding:8px;border:1px solid #ddd">${momoNumber}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd">${amount}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd"><strong>Reason</strong></td><td style="padding:8px;border:1px solid #ddd">${description}</td></tr>
                            </table>
                            <p>Please log in to the app and go to <strong>Public Requests</strong> to process this request.</p>
                        `,
                    }).catch((err: any) => {
                            console.error('[Notify] Email failed for oversight admin', admin.email, err?.message || err);
                        });
                } catch (err) {
                    console.error('[Notify] Error sending notification to oversight admin:', err);
                }
            }
        } catch (notifyError) {
            // Don't fail the request if notification fails
            console.error('[Notify] Error fetching admins for notification:', notifyError);
        }

        return NextResponse.json({ success: true, id: publicRequest.id }, { status: 201 });
    } catch (error) {
        console.error('[PublicExpense] Error creating request:', error);
        return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }
}
