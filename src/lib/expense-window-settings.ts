import { prisma } from '@/lib/prisma';
import { DEFAULT_EXPENSE_WINDOW, validateExpenseWindowConfig, type ExpenseWindowConfig } from '@/lib/expense-window';

export interface CampusExpenseWindow extends ExpenseWindowConfig {
    /** The campus whose window this is; null when none could be resolved. */
    campusId: string | null;
    campusName: string | null;
    /** When the campus admin last saved it; null while the starting window applies. */
    updatedAt: Date | null;
}

// HQ → Oversight → Campus → Account, plus the legacy Stream level between
// campus and account. Bounds the walk if the data ever contains a cycle.
const MAX_HOPS = 6;

const windowSelect = {
    id: true,
    name: true,
    level: true,
    parentId: true,
    expenseWindowOpenMinutes: true,
    expenseWindowCloseMinutes: true,
    expenseWindowUpdatedAt: true,
} as const;

interface WindowRow {
    id: string;
    name: string;
    level: string | null;
    parentId: string | null;
    expenseWindowOpenMinutes: number;
    expenseWindowCloseMinutes: number;
    expenseWindowUpdatedAt: Date | null;
}

/**
 * The window in force for an organisation: its own if it is a campus,
 * otherwise its campus's (an account sits under one). Read fresh on every call
 * so a campus admin's edit applies to the next request.
 *
 * Fails open to the default rather than throwing: an organisation outside any
 * campus, a database hiccup or a stored window that fails validation must not
 * take withdrawal submissions down with it.
 */
export async function getExpenseWindowForOrganisation(organisationId: string | null | undefined): Promise<CampusExpenseWindow> {
    const fallback: CampusExpenseWindow = { ...DEFAULT_EXPENSE_WINDOW, campusId: null, campusName: null, updatedAt: null };
    if (!organisationId) return fallback;

    try {
        let id: string | null = organisationId;
        for (let hop = 0; id && hop < MAX_HOPS; hop++) {
            const org: WindowRow | null = await prisma.organisation.findUnique({ where: { id }, select: windowSelect });
            if (!org) break;
            if (org.level === 'CAMPUS') {
                const checked = validateExpenseWindowConfig({
                    openMinutes: org.expenseWindowOpenMinutes,
                    closeMinutes: org.expenseWindowCloseMinutes,
                });
                if (!checked.ok) {
                    console.error(`Campus ${org.id} has an invalid expense window; using the default`);
                    return { ...fallback, campusId: org.id, campusName: org.name };
                }
                return { ...checked.config, campusId: org.id, campusName: org.name, updatedAt: org.expenseWindowUpdatedAt };
            }
            id = org.parentId;
        }
    } catch (error) {
        console.error('Could not read the expense window; using the default', error);
    }
    return fallback;
}
