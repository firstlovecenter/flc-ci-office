import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import {
    generateRoleAssignmentSms,
    generateTransactionNotificationSms,
    generateOrganisationAlertSms,
    generateWeekLockNotificationSms,
    generateApprovalReminderSms,
} from '@/lib/sms-templates';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN can use this endpoint
        if (session.user.role !== 'SUPERADMIN') {
            return new NextResponse('Forbidden', { status: 403 });
        }

        const body = await req.json();
        const { template, templateParams, phoneNumber, userName, userEmail } = body;

        if (!template || !templateParams) {
            return NextResponse.json({ error: 'Template and parameters are required' }, { status: 400 });
        }

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Format and validate phone number
        const formattedPhone = formatGhanaPhone(phoneNumber);
        if (!formattedPhone) {
            return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
        }

        // Password reset / account setup links are email-only and can never be
        // sent through this SMS endpoint.
        if (template === 'password_reset' || template === 'first_role_assignment') {
            return NextResponse.json(
                { error: 'Password reset and account setup are delivered by email only' },
                { status: 400 }
            );
        }
        const resolvedParams = { ...templateParams };

        // Generate message from template (use resolvedParams which has server-generated reset codes)
        let message: string;
        try {
            switch (template) {
                case 'role_assignment':
                    message = await generateRoleAssignmentSms(resolvedParams);
                    break;
                case 'transaction_notification':
                    message = await generateTransactionNotificationSms(resolvedParams);
                    break;
                case 'department_alert':
                    message = await generateOrganisationAlertSms(resolvedParams);
                    break;
                case 'week_lock_notification':
                    message = await generateWeekLockNotificationSms(resolvedParams);
                    break;
                case 'approval_reminder':
                    message = await generateApprovalReminderSms(resolvedParams);
                    break;
                default:
                    return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
            }
        } catch (error: any) {
            return NextResponse.json({ error: 'Failed to generate message: ' + error.message }, { status: 400 });
        }

        // Send SMS
        const result = await sendSms({
            to: formattedPhone,
            message: message,
        });

        if (!result) {
            return NextResponse.json({
                error: 'Failed to send SMS'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `SMS sent successfully to ${userName || 'user'} (${formattedPhone})`,
            recipient: {
                name: userName,
                phone: formattedPhone,
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            error: 'Failed to send SMS: ' + error.message
        }, { status: 500 });
    }
}
