// Server-only balance computations. Always uses Decimal arithmetic; never
// coerces transaction amounts through JS Number.
import { prisma } from '@/lib/prisma';
import { sumDecimals, toDecimal, type Money } from '@/lib/money';
import { getDescendantOrganisationIds } from '@/lib/organisations';

interface BalanceParts {
    income: Money;
    expense: Money;
    balance: Money;
}

/**
 * Compute the APPROVED balance for a organisation.
 *
 * @param organisationId The organisation to compute for.
 * @param includeDescendants If false, only transactions on this exact
 *   organisation are summed. If true, descendants are included.
 *
 * Uses each transaction's `amountInBase` when present, otherwise falls back
 * to `amount`. With a single-currency setup these are equivalent.
 */
export async function getOrganisationBalance(
    organisationId: string,
    includeDescendants: boolean = false,
): Promise<BalanceParts> {
    const organisationIds = includeDescendants
        ? await getDescendantOrganisationIds(organisationId)
        : [organisationId];

    const transactions = await prisma.transaction.findMany({
        where: {
            organisationId: { in: organisationIds },
            status: 'APPROVED',
        },
        select: {
            type: true,
            amount: true,
            amountInBase: true,
        },
    });

    const incomeAmounts = transactions
        .filter(t => t.type === 'INCOME')
        .map(t => t.amountInBase ?? t.amount);
    const expenseAmounts = transactions
        .filter(t => t.type === 'EXPENSE')
        .map(t => t.amountInBase ?? t.amount);

    const income = sumDecimals(incomeAmounts);
    const expense = sumDecimals(expenseAmounts);
    const balance = income.minus(expense);

    return { income, expense, balance };
}

/**
 * Convenience: returns just the balance Decimal for the exact organisation
 * (no descendants). This is the value that expense-request validation must
 * compare against.
 */
export async function getOrganisationApprovedBalance(organisationId: string): Promise<Money> {
    const { balance } = await getOrganisationBalance(organisationId, false);
    return balance;
}

export { toDecimal };
