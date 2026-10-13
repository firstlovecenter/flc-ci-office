import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { canEditExpenseWindow } from '@/lib/roles';
import { describeExpenseWindow, validateExpenseWindowConfig } from '@/lib/expense-window';
import { EXPENSE_WINDOW_SETTING_ID, getExpenseWindowConfig } from '@/lib/expense-window-settings';

export const dynamic = 'force-dynamic';

/** Changes the submission window for every leader. HQ only. */
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canEditExpenseWindow(session.user.role)) {
        return NextResponse.json({ error: 'Only HQ can change the submission window.' }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const checked = validateExpenseWindowConfig(body);
    if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const { openMinutes, closeMinutes } = checked.config;

    try {
        const before = await getExpenseWindowConfig();
        const saved = await prisma.expenseWindowSetting.upsert({
            where: { id: EXPENSE_WINDOW_SETTING_ID },
            create: { id: EXPENSE_WINDOW_SETTING_ID, openMinutes, closeMinutes, updatedById: session.user.id },
            update: { openMinutes, closeMinutes, updatedById: session.user.id },
        });

        const span = (c: { openMinutes: number; closeMinutes: number }) => {
            const { openLabel, closeLabel } = describeExpenseWindow(c);
            return `${openLabel}–${closeLabel}`;
        };
        const from = span(before);
        const to = span(saved);
        await createAuditLog({
            userId: session.user.id,
            actionType: 'UPDATE',
            entityType: 'ExpenseWindowSetting',
            entityId: EXPENSE_WINDOW_SETTING_ID,
            description: `Changed the withdrawal submission window from ${from} to ${to}`,
            beforeData: { openMinutes: before.openMinutes, closeMinutes: before.closeMinutes },
            afterData: { openMinutes: saved.openMinutes, closeMinutes: saved.closeMinutes },
            severity: 'HIGH',
        });

        return NextResponse.json({
            openMinutes: saved.openMinutes,
            closeMinutes: saved.closeMinutes,
            updatedAt: saved.updatedAt,
        });
    } catch (error) {
        console.error('Failed to save the expense window', error);
        return NextResponse.json(
            { error: 'Could not save the submission window. If this is a new deployment, the database migration may not have been applied yet.' },
            { status: 500 },
        );
    }
}
