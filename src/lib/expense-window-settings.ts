import { prisma } from '@/lib/prisma';
import { DEFAULT_EXPENSE_WINDOW, validateExpenseWindowConfig, type ExpenseWindowConfig } from '@/lib/expense-window';

export const EXPENSE_WINDOW_SETTING_ID = 'default';

export interface StoredExpenseWindow extends ExpenseWindowConfig {
    /** When it was last saved; null while the built-in default is in force. */
    updatedAt: Date | null;
}

/**
 * The window currently in force, read fresh on every call so an edit takes
 * effect on the next request.
 *
 * Fails open to the built-in default rather than throwing: a missing row, a
 * migration not yet applied or a database hiccup must not take withdrawal
 * submissions down with it. A stored row that fails validation is ignored the
 * same way, since enforcing it could lock everyone out.
 */
export async function getExpenseWindowConfig(): Promise<StoredExpenseWindow> {
    try {
        const row = await prisma.expenseWindowSetting.findUnique({ where: { id: EXPENSE_WINDOW_SETTING_ID } });
        if (row) {
            const checked = validateExpenseWindowConfig(row);
            if (checked.ok) return { ...checked.config, updatedAt: row.updatedAt };
            console.error('Stored expense window is invalid; using the default', row);
        }
    } catch (error) {
        console.error('Could not read the expense window; using the default', error);
    }
    return { ...DEFAULT_EXPENSE_WINDOW, updatedAt: null };
}
