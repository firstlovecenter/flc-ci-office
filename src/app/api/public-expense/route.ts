import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSms } from '@/lib/sms';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function getExpenseWindowStatus() {
    const now = new Date();
    const hour = now.getHours();
    const isSaturday = now.getDay() === 6;
    const maxHour = isSaturday ? 19 : 15;
    const timeRange = isSaturday ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM';

    return {
        now,
        timeRange,
        isOpen: hour >= 6 && hour < maxHour,
    };
}

// Auth-protected GET:
// - OVERSIGHT_LEADER: requests for own oversight department
// - SUPERADMIN: all public expense requests
// Public POST is below
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const userRoles = Array.isArray(session.user.roles) 
        ? session.user.roles.map(role => (typeof role === 'string' ? role.toUpperCase() : ''))
        : [];
    const isOversightLeader = session.user.role === 'OVERSIGHT_LEADER' || userRoles.includes('OVERSIGHT_LEADER');
    const isSuperAdmin = session.user.role === 'SUPERADMIN' || userRoles.includes('SUPERADMIN');

    if (!isOversightLeader && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leaderOversightDeptId = session.user.activeUserRole?.departmentId || session.user.departmentId;
    if (isOversightLeader && !leaderOversightDeptId) {
        return NextResponse.json({ error: 'No oversight department found for your account' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    try {
        const requests = await prisma.publicExpenseRequest.findMany({
            where: {
                ...(isOversightLeader && leaderOversightDeptId ? { oversightDeptId: leaderOversightDeptId } : {}),
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
                    error: `Expense requests can only be made between ${expenseWindow.timeRange}. Actual time is ${expenseWindow.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
                },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { oversightDeptId, requesterName, churchName, momoName, momoNumber, amount, description } = body;

        // Validate required fields
        if (!oversightDeptId || !requesterName || !churchName || !momoName || !momoNumber || !amount || !description) {
            return NextResponse.json(
                { error: 'All fields are required: oversight church, requester name, church name, Momo name, Momo number, amount, and reason.' },
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
                churchName: churchName.trim(),
                momoName: momoName.trim(),
                momoNumber: momoNumber.trim(),
                amount,
                description: description.trim(),
                oversightDeptId,
                updatedAt: new Date(),
            },
        });

        // Notify OVERSIGHT_LEADER(s) of this oversight church
        try {
            const leaderRoles = await prisma.userRole.findMany({
                where: {
                    role: 'OVERSIGHT_LEADER',
                    departmentId: oversightDeptId,
                },
                include: {
                    user: {
                        select: { phone: true, email: true, name: true, archived: true },
                    },
                },
            });

            const leaders = leaderRoles
                .filter(ur => !ur.user.archived)
                .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                    if (!acc.find(l => l.email === ur.user.email)) {
                        acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                    }
                    return acc;
                }, []);

            const smsMessage = `New Public Expense Request\nFrom: ${requesterName} (${churchName})\nMomo: ${momoName} / ${momoNumber}\nAmount: ${amount}\nReason: ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}\n\nLog in to review and process this request.`;

            for (const leader of leaders) {
                try {
                    if (leader.phone) {
                        sendSms({ to: leader.phone, message: smsMessage }).catch(() => {});
                    }
                    sendEmail({
                        to: leader.email,
                        subject: `New Public Expense Request — ${requesterName} (${churchName})`,
                        html: `
                            <p>Dear ${leader.name || 'Oversight Leader'},</p>
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
                    }).catch(() => {});
                } catch (err) {
                    console.error('[Notify] Error sending notification to oversight leader:', err);
                }
            }
        } catch (notifyError) {
            // Don't fail the request if notification fails
            console.error('[Notify] Error fetching leaders for notification:', notifyError);
        }

        return NextResponse.json({ success: true, id: publicRequest.id }, { status: 201 });
    } catch (error) {
        console.error('[PublicExpense] Error creating request:', error);
        return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }
}
