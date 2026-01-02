import { getISOWeek, getISOWeekYear } from 'date-fns';

export function getCurrentWeek() {
    const now = new Date();
    return {
        weekNumber: getISOWeek(now),
        year: getISOWeekYear(now),
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

/**
 * Format a role enum value for display (e.g., STREAM_LEADER -> Stream Leader)
 */
export function formatRole(role: string | null | undefined): string {
    if (!role) return '';
    
    // Handle special case for SUPERADMIN
    if (role === 'SUPERADMIN') return 'Super Admin';
    
    // Replace underscores with spaces and capitalize each word
    return role
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Format a department level enum value for display (e.g., INTERNATIONAL -> International)
 */
export function formatDepartmentLevel(level: string | null | undefined): string {
    if (!level) return '';
    
    // Capitalize first letter, lowercase the rest
    return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
}

/**
 * Format transaction status for display (e.g., PENDING -> Pending)
 */
export function formatStatus(status: string | null | undefined): string {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format transaction type for display (e.g., INCOME -> Income)
 */
export function formatTransactionType(type: string | null | undefined): string {
    if (!type) return '';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
