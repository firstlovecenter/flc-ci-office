import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getISOWeek, getISOWeekYear } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { formatMoney } from './format-money';

export function getCurrentWeek() {
    const now = new Date();
    return {
        weekNumber: getISOWeek(now),
        year: getISOWeekYear(now),
    };
}

/**
 * Get the ISO week number and year for a specific date.
 * Used when creating/editing transactions with a custom date.
 */
export function getWeekFromDate(date: Date) {
    return {
        weekNumber: getISOWeek(date),
        year: getISOWeekYear(date),
    };
}

export function formatCurrency(amount: number | string, _currencyCode: string = 'GHS', currencySymbol?: string) {
    const formatted = formatMoney(amount);
    return `${currencySymbol || '₵'}${formatted}`;
}

// Format number with commas. Always shows at least `decimals` fraction digits,
// but never truncates stored precision (e.g. 1234.567 stays "1,234.567").
export function formatNumber(amount: number | string, decimals: number = 2): string {
    return formatMoney(amount, decimals);
}

export function isWeekLocked(weekNumber: number, year: number): boolean {
    const { weekNumber: currentWeek, year: currentYear } = getCurrentWeek();

    if (currentYear > year) return true;
    if (currentYear === year && currentWeek > weekNumber) return true;

    return false;
}

import { formatOrgLevel, formatMoneyMovement, formatRoleLabel } from '@/lib/org-model';

/**
 * Format a role enum value for display (bank-style manager/holder labels)
 */
export function formatRole(role: string | null | undefined): string {
    return formatRoleLabel(role);
}

/**
 * Format a church unit or account label for display
 * (DENOMINATION -> HQ, COUNCIL -> Account). Accounts are bank accounts, not church units.
 */
export function formatOrganisationLevel(level: string | null | undefined): string {
    return formatOrgLevel(level);
}

/**
 * Format transaction status for display (e.g., PENDING -> Pending)
 */
export function formatStatus(status: string | null | undefined): string {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format transaction type for display (INCOME -> Deposit, EXPENSE -> Withdrawal)
 */
export function formatTransactionType(type: string | null | undefined): string {
    return formatMoneyMovement(type);
}
