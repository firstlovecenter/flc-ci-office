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
    // Some engines render midnight as "24" under hour12: false.
    const hour = Number(getPart('hour')) % 24;
    const minute = Number(getPart('minute'));

    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) {
        throw new Error(`Unable to resolve expense window time parts for timezone: ${timeZone}`);
    }

    return { weekday, hour, minute };
}

/**
 * The withdrawal-submission window, as minutes after midnight in Ghana time
 * (UTC, no offset). It runs Monday to Saturday; Sundays are always closed.
 *
 * Each campus has its own window, edited by its campus admin from Settings and
 * stored on the campus row; accounts use their campus's window — see
 * lib/expense-window-settings.ts. Nothing here reads them itself: every check
 * and every label takes the config as an argument, so the server check, the
 * client gate and the copy describing them cannot disagree.
 */
export interface ExpenseWindowConfig {
    openMinutes: number;
    closeMinutes: number;
}

/**
 * The window every campus starts with (6:00 AM – 3:00 PM), and the one applied
 * when no campus can be resolved or its stored window cannot be read. Keep in
 * step with the column defaults on Organisation.
 */
export const DEFAULT_EXPENSE_WINDOW: ExpenseWindowConfig = {
    openMinutes: 6 * 60,
    closeMinutes: 15 * 60,
};

const MINUTES_PER_DAY = 24 * 60;

/** 360 → "6:00 AM", 900 → "3:00 PM". */
export function formatWindowTime(minutes: number): string {
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const suffix = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "HH:MM" (as an <input type="time"> gives it) → minutes after midnight, or null. */
export function parseWindowTime(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
}

/** Minutes after midnight → "HH:MM", the value an <input type="time"> expects. */
export function toTimeInputValue(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Checks a window before it is stored. Both times must be whole minutes within
 * the day, and the window must open before it closes — it never spans midnight.
 */
export function validateExpenseWindowConfig(
    input: unknown,
): { ok: true; config: ExpenseWindowConfig } | { ok: false; error: string } {
    const { openMinutes, closeMinutes } = (input ?? {}) as Record<string, unknown>;
    const inDay = (v: unknown): v is number =>
        typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY;

    if (!inDay(openMinutes) || !inDay(closeMinutes)) {
        return { ok: false, error: 'Opening and closing times must both be valid times of day.' };
    }
    if (closeMinutes <= openMinutes) {
        return { ok: false, error: 'The closing time must be later than the opening time.' };
    }
    return { ok: true, config: { openMinutes, closeMinutes } };
}

export function describeExpenseWindow(config: ExpenseWindowConfig) {
    const openLabel = formatWindowTime(config.openMinutes);
    const closeLabel = formatWindowTime(config.closeMinutes);
    return { openLabel, closeLabel, timeRange: `${openLabel} and ${closeLabel}` };
}

export function getExpenseWindowStatus(now: Date = new Date(), config: ExpenseWindowConfig = DEFAULT_EXPENSE_WINDOW) {
    const timeZone = EXPENSE_WINDOW_TIMEZONE;
    const { weekday, hour, minute } = getTimePartsInTimeZone(now, timeZone);
    const minuteOfDay = hour * 60 + minute;

    const isSunday = weekday === 'Sun';
    const isOpen = !isSunday && minuteOfDay >= config.openMinutes && minuteOfDay < config.closeMinutes;

    return {
        now,
        timeZone,
        ...describeExpenseWindow(config),
        isSunday,
        hour,
        minute,
        isOpen,
        /** Minutes left before the window closes; 0 when it is not open. */
        minutesUntilClose: isOpen ? config.closeMinutes - minuteOfDay : 0,
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
export function getMsUntilExpenseWindowOpens(
    now: Date = new Date(),
    config: ExpenseWindowConfig = DEFAULT_EXPENSE_WINDOW,
): number {
    const candidate = new Date(now.getTime());
    candidate.setUTCHours(0, config.openMinutes, 0, 0);
    if (candidate.getTime() <= now.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);

    while (candidate.getUTCDay() === 0) candidate.setUTCDate(candidate.getUTCDate() + 1);

    return candidate.getTime() - now.getTime();
}
