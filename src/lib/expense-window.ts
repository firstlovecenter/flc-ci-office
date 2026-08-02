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
export const EXPENSE_WINDOW_CLOSE_MINUTE = 0;

// Labels are derived here rather than typed out at each call site: the closing
// time has moved twice, and each move left stale "3:30 PM" copy behind in the
// dashboard banner and the submission form.
export const EXPENSE_WINDOW_OPEN_LABEL = '6:00 AM';
export const EXPENSE_WINDOW_CLOSE_LABEL = '3:00 PM';
export const EXPENSE_WINDOW_TIME_RANGE = `${EXPENSE_WINDOW_OPEN_LABEL} and ${EXPENSE_WINDOW_CLOSE_LABEL}`;

function isWithinExpenseWindow(hour: number, minute: number): boolean {
    if (hour < EXPENSE_WINDOW_OPEN_HOUR) return false;
    if (hour > EXPENSE_WINDOW_CLOSE_HOUR) return false;
    if (hour === EXPENSE_WINDOW_CLOSE_HOUR && minute >= EXPENSE_WINDOW_CLOSE_MINUTE) return false;
    return true;
}

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
        isOpen: !isSunday && isWithinExpenseWindow(hour, minute),
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
