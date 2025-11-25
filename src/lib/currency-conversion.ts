import { prisma } from './prisma';

/**
 * Get the base currency for a department
 * - Global level: uses system base currency (USD)
 * - National and below: uses the national department's configured base currency
 */
export async function getDepartmentBaseCurrency(departmentId: string) {
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { level: true },
    });

    if (!department) {
        throw new Error('Department not found');
    }

    // For Global level, use system base currency
    if (department.level === 'GLOBAL') {
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        return systemBase;
    }

    // For other levels, find the National department in the hierarchy
    let currentDeptId: string | null = departmentId;
    let nationalDept = null;

    while (currentDeptId) {
        const dept: { level: string; parentId: string | null } | null = await prisma.department.findUnique({
            where: { id: currentDeptId },
            select: { level: true, parentId: true },
        });

        if (!dept) break;

        if (dept.level === 'NATIONAL') {
            nationalDept = await prisma.department.findUnique({
                where: { id: currentDeptId },
            });
            break;
        }

        currentDeptId = dept.parentId || null;
    }

    if (nationalDept) {
        // Get the base currency for this national department
        const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
            where: { departmentId: nationalDept.id },
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

    if (role === 'SUPERADMIN' || role === 'GLOBAL_ADMIN') {
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
 * Convert an amount from one currency to another using exchange rates
 */
export function convertCurrency(
    amount: number,
    fromCurrencyId: string,
    toCurrencyId: string,
    exchangeRates: any[]
): number {
    // If same currency, no conversion needed
    if (fromCurrencyId === toCurrencyId) {
        return amount;
    }

    // Find direct exchange rate: fromCurrency → toCurrency
    let rate = exchangeRates.find(
        (r) => r.fromCurrency.id === fromCurrencyId && r.toCurrency.id === toCurrencyId
    );

    if (rate) {
        const converted = amount * parseFloat(rate.rate.toString());
        return converted;
    }

    // Try reverse: toCurrency → fromCurrency
    rate = exchangeRates.find(
        (r) => r.fromCurrency.id === toCurrencyId && r.toCurrency.id === fromCurrencyId
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
    exchangeRates: any[]
): number {
    return convertCurrency(amount, fromCurrencyId, userBaseCurrencyId, exchangeRates);
}
