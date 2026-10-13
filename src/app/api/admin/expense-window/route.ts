import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { canEditExpenseWindow } from '@/lib/roles';
import { describeExpenseWindow, validateExpenseWindowConfig, type ExpenseWindowConfig } from '@/lib/expense-window';
import { getExpenseWindowForOrganisation } from '@/lib/expense-window-settings';

export const dynamic = 'force-dynamic';

/**
 * The campus a campus admin is acting for: their active role's organisation,
 * which must be a campus. A campus admin only ever edits their own campus, so
 * the campus is never taken from the request.
 */
async function resolveOwnCampus(session: Session) {
    if (!canEditExpenseWindow(session.user.role)) return null;
    const organisationId = session.user.activeUserRole?.organisationId ?? session.user.organisationId;
    if (!organisationId) return null;
    const campus = await prisma.organisation.findUnique({
        where: { id: organisationId },
        select: { id: true, name: true, level: true },
    });
    return campus?.level === 'CAMPUS' ? campus : null;
}

const forbidden = () =>
    NextResponse.json({ error: 'Only a campus admin can change their campus’s submission window.' }, { status: 403 });

/** The signed-in campus admin's own campus window. */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const campus = await resolveOwnCampus(session);
    if (!campus) return forbidden();

    const { openMinutes, closeMinutes, updatedAt } = await getExpenseWindowForOrganisation(campus.id);
    return NextResponse.json({ campusId: campus.id, campusName: campus.name, openMinutes, closeMinutes, updatedAt });
}

/** Changes the signed-in campus admin's own campus window. */
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const campus = await resolveOwnCampus(session);
    if (!campus) return forbidden();

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
        const before = await getExpenseWindowForOrganisation(campus.id);
        const saved = await prisma.organisation.update({
            where: { id: campus.id },
            data: {
                expenseWindowOpenMinutes: openMinutes,
                expenseWindowCloseMinutes: closeMinutes,
                expenseWindowUpdatedAt: new Date(),
            },
            select: { expenseWindowOpenMinutes: true, expenseWindowCloseMinutes: true, expenseWindowUpdatedAt: true },
        });

        const span = (c: ExpenseWindowConfig) => {
            const { openLabel, closeLabel } = describeExpenseWindow(c);
            return `${openLabel}–${closeLabel}`;
        };
        const after = { openMinutes: saved.expenseWindowOpenMinutes, closeMinutes: saved.expenseWindowCloseMinutes };
        await createAuditLog({
            userId: session.user.id,
            actionType: 'UPDATE',
            entityType: 'Organisation',
            entityId: campus.id,
            description: `Changed ${campus.name}'s withdrawal submission window from ${span(before)} to ${span(after)}`,
            beforeData: { openMinutes: before.openMinutes, closeMinutes: before.closeMinutes },
            afterData: after,
            metadata: { setting: 'expense-window' },
            severity: 'HIGH',
        });

        return NextResponse.json({
            campusId: campus.id,
            campusName: campus.name,
            ...after,
            updatedAt: saved.expenseWindowUpdatedAt,
        });
    } catch (error) {
        console.error('Failed to save the expense window', error);
        return NextResponse.json(
            { error: 'Could not save the submission window. If this is a new deployment, the database migration may not have been applied yet.' },
            { status: 500 },
        );
    }
}
