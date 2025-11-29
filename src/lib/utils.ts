import { getISOWeek, getYear } from 'date-fns';

export function getCurrentWeek() {
    const now = new Date();
    return {
        weekNumber: getISOWeek(now),
        year: getYear(now),
    };
}

export function formatCurrency(amount: number | string, currencyCode: string = 'GHS', currencySymbol?: string) {
    if (currencySymbol) {
        // Use custom symbol if provided
        return `${currencySymbol}${Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }
    
    // Use built-in currency formatting
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(Number(amount));
    } catch {
        // Fallback if currency code is invalid
        return `${Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }
}

// Format number with commas (no currency symbol)
export function formatNumber(amount: number | string, decimals: number = 2): string {
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function isWeekLocked(weekNumber: number, year: number): boolean {
    const { weekNumber: currentWeek, year: currentYear } = getCurrentWeek();

    if (currentYear > year) return true;
    if (currentYear === year && currentWeek > weekNumber) return true;

    return false;
}
