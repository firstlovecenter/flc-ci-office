import { isWeekLocked, getWeekFromDate } from '@/lib/utils';

/** Roles allowed to write to (or edit rows in) a closed ISO week. */
export const PERIOD_LOCK_OVERRIDE_ROLES = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN'];

export function canWriteToLockedWeek(role: string): boolean {
    return PERIOD_LOCK_OVERRIDE_ROLES.includes(role);
}

/**
 * Whether `role` may place a row on `date`'s ISO week. Open (current/future)
 * weeks are always fine, so legitimate backdating inside the open week works;
 * only a closed week needs Oversight or above.
 */
export function canWriteOnDate(role: string, date: Date): boolean {
    const { weekNumber, year } = getWeekFromDate(date);
    return !isWeekLocked(weekNumber, year) || canWriteToLockedWeek(role);
}

export const LOCKED_WEEK_ERROR =
    'That week is closed. Only Oversight Admin and above can add or move transactions into a past week.';
