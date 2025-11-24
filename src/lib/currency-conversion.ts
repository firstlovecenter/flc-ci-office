import { prisma } from './prisma';

export async function getUserBaseCurrency(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            department: {
                include: {
                    parent: {
                        include: {
                            parent: {
                                include: {
                                    parent: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Use the active role, or fall back to first role if no active role set
    const activeRole = user.activeRole || user.roles?.[0] || 'COUNCIL_LEADER';

    // For international level and above, use system base currency
    const highLevelRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'GLOBAL_LEADER', 'INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER'];
    const isHighLevel = highLevelRoles.includes(activeRole);
    
    if (isHighLevel) {
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        return systemBase;
    }

    // For national level and below, find the national department's base currency
    let nationalDept = user.department;
    
    // For national admin/leader, use their current department
    // For below national level, traverse up to find national department
    const regionalRoles = ['REGIONAL_ADMIN', 'REGIONAL_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const isRegional = regionalRoles.includes(activeRole);
    
    if (isRegional) {
        while (nationalDept && nationalDept.level !== 'NATIONAL') {
            nationalDept = nationalDept.parent as typeof nationalDept;
        }
    }

    if (nationalDept && nationalDept.level === 'NATIONAL') {
        // Check if this national department has a base currency set
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

export function convertToUserBaseCurrency(
    amount: number,
    fromCurrencyId: string,
    userBaseCurrencyId: string,
    exchangeRates: any[]
): number {
    // If same currency, no conversion needed
    if (fromCurrencyId === userBaseCurrencyId) {
        return amount;
    }

    // Find direct exchange rate: fromCurrency → userBaseCurrency
    let rate = exchangeRates.find(
        (r) => r.fromCurrency.id === fromCurrencyId && r.toCurrency.id === userBaseCurrencyId
    );

    if (rate) {
        const converted = amount * parseFloat(rate.rate.toString());
        return converted;
    }

    // Try reverse: userBaseCurrency → fromCurrency
    rate = exchangeRates.find(
        (r) => r.fromCurrency.id === userBaseCurrencyId && r.toCurrency.id === fromCurrencyId
    );

    if (rate) {
        const converted = amount / parseFloat(rate.rate.toString());
        return converted;
    }

    // No conversion rate found, return original amount
    return amount;
}
