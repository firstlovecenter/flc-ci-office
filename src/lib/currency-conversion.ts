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

    console.log(`getUserBaseCurrency for user ${user.email}, role: ${user.roles?.[0] || 'undefined'}`);

    // For international level and above, use system base currency
    const highLevelRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'GLOBAL_LEADER', 'INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER'];
    const hasHighLevelRole = user.roles && user.roles.some(role => highLevelRoles.includes(role));
    
    if (hasHighLevelRole) {
        const systemBase = await prisma.currency.findFirst({
            where: { isBase: true },
        });
        console.log(`International user - using system base:`, systemBase?.code);
        return systemBase;
    }

    // For national level and below, find the national department's base currency
    let nationalDept = user.department;
    
    // For national admin/leader, use their current department
    // For below national level, traverse up to find national department
    const regionalRoles = ['REGIONAL_ADMIN', 'REGIONAL_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const hasRegionalRole = user.roles && user.roles.some(role => regionalRoles.includes(role));
    
    if (hasRegionalRole) {
        console.log(`User is below national, traversing up from department:`, nationalDept?.name);
        while (nationalDept && nationalDept.level !== 'NATIONAL') {
            nationalDept = nationalDept.parent as typeof nationalDept;
        }
        console.log(`Found national department:`, nationalDept?.name);
    }

    if (nationalDept && nationalDept.level === 'NATIONAL') {
        // Check if this national department has a base currency set
        const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
            where: { departmentId: nationalDept.id },
            include: { currency: true },
        });

        if (deptBaseCurrency) {
            console.log(`Using department base currency:`, deptBaseCurrency.currency.code);
            return deptBaseCurrency.currency;
        } else {
            console.log(`No department base currency set for:`, nationalDept.name);
        }
    }

    // Fallback to system base currency
    const systemBase = await prisma.currency.findFirst({
        where: { isBase: true },
    });
    console.log(`Fallback to system base:`, systemBase?.code);
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
        console.log(`Direct conversion: ${amount} × ${rate.rate} = ${converted}`);
        return converted;
    }

    // Try reverse: userBaseCurrency → fromCurrency
    rate = exchangeRates.find(
        (r) => r.fromCurrency.id === userBaseCurrencyId && r.toCurrency.id === fromCurrencyId
    );

    if (rate) {
        const converted = amount / parseFloat(rate.rate.toString());
        console.log(`Reverse conversion: ${amount} ÷ ${rate.rate} = ${converted}`);
        return converted;
    }

    // No conversion rate found, return original amount
    console.log(`No exchange rate found between ${fromCurrencyId} and ${userBaseCurrencyId}`);
    return amount;
}
