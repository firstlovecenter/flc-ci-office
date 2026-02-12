import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// GET all SMS templates
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only SUPERADMIN can manage templates
        const isSuperAdmin =
            session.user.role === 'SUPERADMIN' ||
            session.user.roles?.includes('SUPERADMIN');
        if (!isSuperAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const templates = await prisma.smsTemplate.findMany({
            orderBy: { name: 'asc' },
        });

        // If no templates exist, seed them
        if (templates.length === 0) {
            await seedTemplates();
            const newTemplates = await prisma.smsTemplate.findMany({
                orderBy: { name: 'asc' },
            });
            return NextResponse.json(newTemplates);
        }

        return NextResponse.json(templates);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch SMS templates' },
            { status: 500 }
        );
    }
}

// PUT update a template
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session.user.roles?.includes('SUPERADMIN')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id, template } = await request.json();

        if (!id || !template) {
            return NextResponse.json(
                { error: 'Template ID and content are required' },
                { status: 400 }
            );
        }

        const updated = await prisma.smsTemplate.update({
            where: { id },
            data: { template },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to update SMS template' },
            { status: 500 }
        );
    }
}

async function seedTemplates() {
    const defaultTemplates = [
        {
            key: 'password_reset',
            name: 'Password Reset',
            description: 'Sent when user requests password reset',
            template: 'CI Office: Your password reset code is {{resetCode}}. Valid for {{expirationHours}} hours. Go to the reset page and enter this code.',
            variables: ['resetCode', 'expirationHours'],
        },
        {
            key: 'first_role_assignment',
            name: 'First Role Assignment',
            description: 'Sent when user gets their first role and needs to set password',
            template: 'Welcome {{userName}}! You\'ve been assigned as {{role}} for {{department}}. Set your password here: {{resetLink}}',
            variables: ['userName', 'role', 'department', 'resetLink'],
        },
        {
            key: 'role_assignment',
            name: 'Role Assignment',
            description: 'Sent when user role is updated',
            template: 'CI Office: Hello {{userName}}, your role has been updated to {{role}} for {{department}}.',
            variables: ['userName', 'role', 'department'],
        },
        {
            key: 'transaction_notification',
            name: 'Transaction Notification',
            description: 'Sent when transaction status changes',
            template: 'CI Office: {{userName}}, your {{type}} transaction of {{amount}} is now {{status}}.',
            variables: ['userName', 'type', 'amount', 'status'],
        },
        {
            key: 'department_alert',
            name: 'Department Alert',
            description: 'Sent for department-wide announcements',
            template: 'CI Office - {{departmentName}}: {{message}}',
            variables: ['departmentName', 'message'],
        },
        {
            key: 'week_lock_notification',
            name: 'Week Lock Notification',
            description: 'Sent when a week is locked',
            template: 'CI Office: Hello {{userName}}, Week {{weekNumber}} has been locked. No further changes can be made to transactions for this week.',
            variables: ['userName', 'weekNumber'],
        },
        {
            key: 'approval_reminder',
            name: 'Approval Reminder',
            description: 'Sent to remind approvers of pending transactions',
            template: 'CI Office: Hello {{userName}}, you have {{pendingCount}} transaction(s) pending your approval. {{dashboardLink}}',
            variables: ['userName', 'pendingCount', 'dashboardLink'],
        },
    ];

    const templatesToCreate = defaultTemplates.map((template) => ({
        id: crypto.randomUUID(),
        key: template.key,
        name: template.name,
        description: template.description,
        template: template.template,
        variables: template.variables,
        updatedAt: new Date(),
    }));

    await prisma.smsTemplate.createMany({
        data: templatesToCreate,
        skipDuplicates: true,
    });
}
