import { prisma } from './prisma';
import { DepartmentLevel } from '@prisma/client';
import { toDecimal, type Money, type MoneyInput } from './money';

/**
 * Get the base currency for a department
 * - Denomination level: uses system base currency (USD)
 * - Oversight and below: uses the oversight department's configured base currency
 */
export async function getDepartmentBaseCurrency(departmentId: string) {
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { level: true },
    });

    if (!department) {
        throw new Error('Department not found');
    }

    // For Denomination level, use system base currency
    if (department.level === 'DENOMINATION') {
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        return systemBase;
    }

    // For other levels, find the Oversight department in the hierarchy
    let currentDeptId: string | null = departmentId;
    let oversightDept = null;

    while (currentDeptId) {
        const dept: { level: DepartmentLevel | null; parentId: string | null } | null = await prisma.department.findUnique({
            where: { id: currentDeptId },
            select: { level: true, parentId: true },
        });

        if (!dept) break;

        if (dept.level === 'OVERSIGHT') {
            oversightDept = await prisma.department.findUnique({
                where: { id: currentDeptId },
            });
            break;
        }

        currentDeptId = dept.parentId || null;
    }

    if (oversightDept) {
        // Get the base currency for this oversight department
        const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
            where: { departmentId: oversightDept.id },
            include: { currency: true },
        });

        if (deptBaseCurrency) {
            return deptBaseCurrency.currency;
        }
    }

    // Fallback to system base currency
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
                    role: true
                }
            }
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

/**
 * Convert an amount from one currency to another using exchange rates.
 * Uses Decimal arithmetic so the result is exact (no IEEE-754 drift).
 */
export function convertCurrency(
    amount: MoneyInput,
    fromCurrencyId: string,
    toCurrencyId: string,
    exchangeRates: any[]
): Money {
    const dec = toDecimal(amount);

    if (fromCurrencyId === toCurrencyId) {
        return dec;
    }

    let rate = exchangeRates.find(
        (r) => r.fromCurrency.id === fromCurrencyId && r.toCurrency.id === toCurrencyId
    );
    if (rate) {
        return dec.mul(toDecimal(rate.rate));
    }

    rate = exchangeRates.find(
        (r) => r.fromCurrency.id === toCurrencyId && r.toCurrency.id === fromCurrencyId
    );
    if (rate) {
        return dec.div(toDecimal(rate.rate));
    }

    return dec;
}

/**
 * @deprecated Use convertCurrency instead
 * Legacy function kept for backward compatibility
 */
export function convertToUserBaseCurrency(
    amount: MoneyInput,
    fromCurrencyId: string,
    userBaseCurrencyId: string,
    exchangeRates: any[]
): Money {
    return convertCurrency(amount, fromCurrencyId, userBaseCurrencyId, exchangeRates);
}
