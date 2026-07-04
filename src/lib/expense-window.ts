const EXPENSE_WINDOW_TIMEZONE = 'UTC';

function getTimePartsInTimeZone(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

    const weekday = getPart('weekday');
    const hour = Number(getPart('hour'));
    const minute = Number(getPart('minute'));

    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) {
        throw new Error(`Unable to resolve expense window time parts for timezone: ${timeZone}`);
    }

    return { weekday, hour, minute };
}

export const EXPENSE_WINDOW_OPEN_HOUR = 6;
export const EXPENSE_WINDOW_CLOSE_HOUR = 15;
export const EXPENSE_WINDOW_TIME_RANGE = '6:00 AM and 3:00 PM';

export function getExpenseWindowStatus(now: Date = new Date()) {
    const timeZone = EXPENSE_WINDOW_TIMEZONE;
    const { weekday, hour, minute } = getTimePartsInTimeZone(now, timeZone);

    const isSunday = weekday === 'Sun';

    return {
        now,
        timeZone,
        timeRange: EXPENSE_WINDOW_TIME_RANGE,
        isSunday,
        hour,
        minute,
        isOpen: !isSunday && hour >= EXPENSE_WINDOW_OPEN_HOUR && hour < EXPENSE_WINDOW_CLOSE_HOUR,
    };
}

export function formatTimeInExpenseWindowTimeZone(date: Date) {
    const timeZone = EXPENSE_WINDOW_TIMEZONE;
    return date.toLocaleTimeString('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

// Milliseconds until the window next opens, skipping Sunday. `now` is assumed
// to already be in the expense window's timezone (UTC, i.e. no offset from Ghana time).
export function getMsUntilExpenseWindowOpens(now: Date = new Date()): number {
    const candidate = new Date(now.getTime());
    candidate.setUTCHours(EXPENSE_WINDOW_OPEN_HOUR, 0, 0, 0);
    if (candidate.getTime() <= now.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);

    while (candidate.getUTCDay() === 0) candidate.setUTCDate(candidate.getUTCDate() + 1);

    return candidate.getTime() - now.getTime();
}
