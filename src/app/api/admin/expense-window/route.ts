import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { canEditAnyCampusExpenseWindow, canEditExpenseWindow } from '@/lib/roles';
import {
    DEFAULT_EXPENSE_WINDOW,
    describeExpenseWindow,
    validateExpenseWindowConfig,
    type ExpenseWindowConfig,
} from '@/lib/expense-window';

export const dynamic = 'force-dynamic';

const campusSelect = {
    id: true,
    name: true,
    level: true,
    parent: { select: { name: true } },
    expenseWindowOpenMinutes: true,
    expenseWindowCloseMinutes: true,
    expenseWindowUpdatedAt: true,
} as const;

type CampusRow = {
    id: string;
    name: string;
    level: string | null;
    parent: { name: string } | null;
    expenseWindowOpenMinutes: number;
    expenseWindowCloseMinutes: number;
    expenseWindowUpdatedAt: Date | null;
};

function toCampusWindow(c: CampusRow) {
    const checked = validateExpenseWindowConfig({ openMinutes: c.expenseWindowOpenMinutes, closeMinutes: c.expenseWindowCloseMinutes });
    const { openMinutes, closeMinutes } = checked.ok ? checked.config : DEFAULT_EXPENSE_WINDOW;
    return {
        campusId: c.id,
        campusName: c.name,
        oversightName: c.parent?.name ?? null,
        openMinutes,
        closeMinutes,
        updatedAt: c.expenseWindowUpdatedAt,
    };
}

/**
 * The campus whose window this request may change.
 *
 * A campus admin only ever edits their own campus: their active role's
 * organisation, never one named in the request. A super admin names the campus,
 * which must exist and be a campus. Anyone else gets null.
 */
async function resolveCampus(session: Session, requestedCampusId: unknown): Promise<CampusRow | null> {
    const role = session.user.role;
    if (!canEditExpenseWindow(role)) return null;

    const campusId = canEditAnyCampusExpenseWindow(role)
        ? (typeof requestedCampusId === 'string' && requestedCampusId ? requestedCampusId : null)
        : (session.user.activeUserRole?.organisationId ?? session.user.organisationId ?? null);
    if (!campusId) return null;

    const campus: CampusRow | null = await prisma.organisation.findUnique({ where: { id: campusId }, select: campusSelect });
    return campus?.level === 'CAMPUS' ? campus : null;
}

const unauthenticated = () => NextResponse.json({ error: 'Authentication required' }, { status: 401 });

/**
 * The windows this user may edit. A campus admin gets their own campus; a super
 * admin gets every active campus and `canChooseCampus`, which shows the picker.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return unauthenticated();
    const role = session.user.role;

    if (canEditAnyCampusExpenseWindow(role)) {
        const campuses: CampusRow[] = await prisma.organisation.findMany({
            where: { level: 'CAMPUS', isActive: true },
            select: campusSelect,
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ canChooseCampus: true, campuses: campuses.map(toCampusWindow) });
    }

    const campus = await resolveCampus(session, null);
    if (!campus) {
        return NextResponse.json({ error: 'Only campus admins and super admins can change submission windows.' }, { status: 403 });
    }
    return NextResponse.json({ canChooseCampus: false, campuses: [toCampusWindow(campus)] });
}

/**
 * Changes a campus's window: `{ openMinutes, closeMinutes }`, plus `campusId`
 * from a super admin. A campus admin's request always saves to their own
 * campus, whatever it names.
 */
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return unauthenticated();

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const campus = await resolveCampus(session, body?.campusId);
    if (!campus) {
        if (canEditAnyCampusExpenseWindow(session.user.role)) {
            return NextResponse.json({ error: 'Choose a campus to change.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Only campus admins and super admins can change submission windows.' }, { status: 403 });
    }

    const checked = validateExpenseWindowConfig(body);
    if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const { openMinutes, closeMinutes } = checked.config;

    try {
        const before = toCampusWindow(campus);
        const saved: CampusRow = await prisma.organisation.update({
            where: { id: campus.id },
            data: {
                expenseWindowOpenMinutes: openMinutes,
                expenseWindowCloseMinutes: closeMinutes,
                expenseWindowUpdatedAt: new Date(),
            },
            select: campusSelect,
        });
        const after = toCampusWindow(saved);

        const span = (c: ExpenseWindowConfig) => {
            const { openLabel, closeLabel } = describeExpenseWindow(c);
            return `${openLabel}–${closeLabel}`;
        };
        await createAuditLog({
            userId: session.user.id,
            actionType: 'UPDATE',
            entityType: 'Organisation',
            entityId: campus.id,
            description: `Changed ${campus.name}'s withdrawal submission window from ${span(before)} to ${span(after)}`,
            beforeData: { openMinutes: before.openMinutes, closeMinutes: before.closeMinutes },
            afterData: { openMinutes: after.openMinutes, closeMinutes: after.closeMinutes },
            metadata: { setting: 'expense-window', editedAs: session.user.role },
            severity: 'HIGH',
        });

        return NextResponse.json(after);
    } catch (error) {
        console.error('Failed to save the expense window', error);
        return NextResponse.json({ error: 'Could not save the submission window.' }, { status: 500 });
    }
}
