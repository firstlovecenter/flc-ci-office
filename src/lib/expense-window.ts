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

export function getExpenseWindowStatus(now: Date = new Date()) {
    const timeZone = EXPENSE_WINDOW_TIMEZONE;
    const { hour } = getTimePartsInTimeZone(now, timeZone);

    const maxHour = 15;
    const timeRange = '6:00 AM and 3:00 PM';

    return {
        now,
        timeZone,
        timeRange,
        isOpen: hour >= 6 && hour < maxHour,
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
