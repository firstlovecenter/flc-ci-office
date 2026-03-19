import { prisma } from './prisma';

/**
 * Get the base currency for a department.
 * - DENOMINATION level → system base currency
 * - All other levels → walk up to the OVERSIGHT ancestor and use its configured
 *   base currency (falls back to system base currency if none configured).
 *
 * Uses a single query with nested parent includes instead of N sequential
 * queries to avoid the N+1 problem for 5-level department hierarchies.
 */
export async function getDepartmentBaseCurrency(departmentId: string) {
    // Fetch the department and its full ancestor chain in one query.
    // The hierarchy is at most 5 levels deep (DENOMINATION → COUNCIL), so
    // four levels of parent nesting covers every possible path.
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: {
            id: true,
            level: true,
            departmentBaseCurrency: { include: { currency: true } },
            parent: {
                select: {
                    id: true,
                    level: true,
                    departmentBaseCurrency: { include: { currency: true } },
                    parent: {
                        select: {
                            id: true,
                            level: true,
                            departmentBaseCurrency: { include: { currency: true } },
                            parent: {
                                select: {
                                    id: true,
                                    level: true,
                                    departmentBaseCurrency: { include: { currency: true } },
                                    parent: {
                                        select: {
                                            id: true,
                                            level: true,
                                            departmentBaseCurrency: { include: { currency: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!department) {
        throw new Error('Department not found');
    }

    // Walk up the pre-fetched ancestor chain to find the OVERSIGHT node.
    type DeptNode = typeof department;
    let node: DeptNode | null = department;
    while (node) {
        if (node.level === 'DENOMINATION') break; // use system base
        if (node.level === 'OVERSIGHT') {
            if (node.departmentBaseCurrency?.currency) {
                return node.departmentBaseCurrency.currency;
            }
            break; // Oversight found but no currency configured → fall through
        }
        node = node.parent as DeptNode | null;
    }

    // Fallback: system base currency (single query, cached by Prisma connection pool)
    const systemBase = await prisma.currency.findFirst({
        where: { isBase: true },
    });
    return systemBase;
}

/**
 * @deprecated Use getDepartmentBaseCurrency instead
 * Legacy function kept for backward compatibility
 */
export async function getUserBaseCurrency(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            departmentId: true,
            activeRole: true,
            activeUserRole: {
                select: {
                    role: true,
                },
            },
        },
    });

    const role = user?.activeUserRole?.role || user?.activeRole;

    if (role === 'SUPERADMIN' || role === 'DENOMINATION_ADMIN') {
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        return systemBase;
    }

    if (!user || !user.departmentId) {
        // Fallback to system base currency
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        return systemBase;
    }

    return getDepartmentBaseCurrency(user.departmentId);
}

export interface ExchangeRateRow {
    fromCurrency: { id: string };
    toCurrency: { id: string };
    rate: string | number | { toString(): string };
}

/**
 * Convert an amount from one currency to another using exchange rates
 */
export function convertCurrency(
    amount: number,
    fromCurrencyId: string,
    toCurrencyId: string,
    exchangeRates: ExchangeRateRow[],
): number {
    // If same currency, no conversion needed
    if (fromCurrencyId === toCurrencyId) {
        return amount;
    }

    // Find direct exchange rate: fromCurrency → toCurrency
    let rate = exchangeRates.find(
        (r) => r.fromCurrency.id === fromCurrencyId && r.toCurrency.id === toCurrencyId,
    );

    if (rate) {
        const converted = amount * parseFloat(rate.rate.toString());
        return converted;
    }

    // Try reverse: toCurrency → fromCurrency
    rate = exchangeRates.find(
        (r) => r.fromCurrency.id === toCurrencyId && r.toCurrency.id === fromCurrencyId,
    );

    if (rate) {
        const converted = amount / parseFloat(rate.rate.toString());
        return converted;
    }

    // No conversion rate found, return original amount
    return amount;
}

/**
 * @deprecated Use convertCurrency instead
 * Legacy function kept for backward compatibility
 */
export function convertToUserBaseCurrency(
    amount: number,
    fromCurrencyId: string,
    userBaseCurrencyId: string,
    exchangeRates: ExchangeRateRow[],
): number {
    return convertCurrency(amount, fromCurrencyId, userBaseCurrencyId, exchangeRates);
}
