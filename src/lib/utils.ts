import { getISOWeek, getYear } from 'date-fns';

export function getCurrentWeek() {
    const now = new Date();
    return {
        weekNumber: getISOWeek(now),
        year: getYear(now),
    };
}

export function formatCurrency(amount: number | string) {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
    }).format(Number(amount));
}

export function isWeekLocked(weekNumber: number, year: number): boolean {
    const { weekNumber: currentWeek, year: currentYear } = getCurrentWeek();

    if (currentYear > year) return true;
    if (currentYear === year && currentWeek > weekNumber) return true;

    return false;
}
