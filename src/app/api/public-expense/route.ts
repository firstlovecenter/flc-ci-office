import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSms } from '@/lib/sms';
import { generatePublicExpenseRequestSms, generatePublicExpenseLeaderSubmittedSms } from '@/lib/sms-templates';
import { formatTimeInExpenseWindowTimeZone, getExpenseWindowStatus } from '@/lib/expense-window';

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

// Auth-protected GET:
// - CAMPUS_ADMIN: requests for own campus
// - SUPERADMIN: all public expense requests
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const userRoles = Array.isArray(session.user.roles)
        ? session.user.roles.map(role => (typeof role === 'string' ? role.toUpperCase() : ''))
        : [];
    const isCampusAdmin = session.user.role === 'CAMPUS_ADMIN' || userRoles.includes('CAMPUS_ADMIN');
    const isSuperAdmin = session.user.role === 'SUPERADMIN' || userRoles.includes('SUPERADMIN');

    if (!isCampusAdmin && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let adminCampusId: string | undefined;
    if (isCampusAdmin && !isSuperAdmin) {
        adminCampusId = await resolveCampusAdminOrgId(session);
        if (!adminCampusId) {
            return NextResponse.json({ error: 'No campus found for your account' }, { status: 400 });
        }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    try {
        const requests = await prisma.publicExpenseRequest.findMany({
            where: {
                ...(adminCampusId ? { campusOrganisationId: adminCampusId } : {}),
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
export async function POST(request: Request) {
    try {
        const expenseWindow = getExpenseWindowStatus();
        if (!expenseWindow.isOpen) {
            return NextResponse.json(
                {
                    error: expenseWindow.isSunday
                        ? 'Expense requests are not accepted on Sundays. Please try again Monday from 6:00 AM.'
                        : `Expense requests can only be made between ${expenseWindow.timeRange}. Actual time is ${formatTimeInExpenseWindowTimeZone(expenseWindow.now)}`,
                },
                { status: 400 }
            );
        }

        const body = await request.json();
        const campusOrganisationId = body.campusOrganisationId || body.oversightOrganisationId;
        const { requesterName, leaderPhone, churchName, momoName, momoNumber, amount, description } = body;

        if (!campusOrganisationId || !requesterName || !leaderPhone || !churchName || !momoName || !momoNumber || !amount || !description) {
            return NextResponse.json(
                { error: 'All fields are required: campus, requester name, leader phone, church name, Momo name, Momo number, amount, and reason.' },
                { status: 400 }
            );
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
        }

        const campus = await prisma.organisation.findUnique({
            where: { id: campusOrganisationId, level: 'CAMPUS', isActive: true, publicFormEnabled: true },
            select: { id: true, name: true },
        });

        if (!campus) {
            return NextResponse.json({ error: 'Invalid campus selected.' }, { status: 400 });
        }

        const publicRequest = await prisma.publicExpenseRequest.create({
            data: {
                requesterName: requesterName.trim(),
                leaderPhone: leaderPhone.trim(),
                churchName: churchName.trim(),
                momoName: momoName.trim(),
                momoNumber: momoNumber.trim(),
                amount,
                description: description.trim(),
                campusOrganisationId,
                updatedAt: new Date(),
            },
        });

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

        try {
            const adminRoles = await prisma.userRole.findMany({
                where: {
                    role: 'CAMPUS_ADMIN',
                    organisationId: campusOrganisationId,
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
                campusOrganisationName: campus.name,
            });

            for (const admin of admins) {
                try {
                    if (admin.phone) {
                        sendSms({ to: admin.phone, message: smsMessage }).catch((err) => {
                            console.error('[Notify] SMS failed for campus admin', admin.phone, err?.message || err);
                        });
                    } else {
                        console.warn('[Notify] Campus admin has no phone number:', admin.email);
                    }
                } catch (err) {
                    console.error('[Notify] Error sending notification to campus admin:', err);
                }
            }
        } catch (notifyError) {
            console.error('[Notify] Error fetching admins for notification:', notifyError);
        }

        return NextResponse.json({ success: true, id: publicRequest.id }, { status: 201 });
    } catch (error) {
        console.error('[PublicExpense] Error creating request:', error);
        return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }
}
