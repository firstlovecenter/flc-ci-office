/**
 * The withdrawal-submission window.
 *
 * The window is edited from the Settings page, so the check and the copy
 * describing it are both derived from one config. These pin the arithmetic
 * against the default (6:00 AM to 4:45 PM) and an arbitrary edited window,
 * Monday to Saturday, evaluated in UTC (Ghana time, no offset).
 */
import { describe, it, expect } from 'vitest';
import {
    getExpenseWindowStatus,
    getMsUntilExpenseWindowOpens,
    DEFAULT_EXPENSE_WINDOW,
    formatWindowTime,
    parseWindowTime,
    toTimeInputValue,
    validateExpenseWindowConfig,
} from './expense-window';

/** 2026-08-03 is a Monday; 2026-08-08 a Saturday; 2026-08-09 a Sunday. */
const monday = (time: string) => new Date(`2026-08-03T${time}Z`);
const saturday = (time: string) => new Date(`2026-08-08T${time}Z`);
const sunday = (time: string) => new Date(`2026-08-09T${time}Z`);

describe('default window', () => {
    it('is 6:00 AM to 4:45 PM', () => {
        expect(DEFAULT_EXPENSE_WINDOW).toEqual({ openMinutes: 360, closeMinutes: 1005 });
    });

    it('opens at 6:00 AM and closes at 4:45 PM', () => {
        expect(getExpenseWindowStatus(monday('05:59:59')).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('06:00:00')).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('16:44:59')).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('16:45:00')).isOpen).toBe(false);
    });

    it('is shut overnight', () => {
        expect(getExpenseWindowStatus(monday('23:00:00')).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('00:00:00')).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('03:00:00')).isOpen).toBe(false);
    });

    it('runs Monday to Saturday but never on Sunday', () => {
        expect(getExpenseWindowStatus(saturday('10:00:00')).isOpen).toBe(true);
        const shut = getExpenseWindowStatus(sunday('10:00:00'));
        expect(shut.isSunday).toBe(true);
        expect(shut.isOpen).toBe(false);
    });
});

describe('an edited window', () => {
    const config = { openMinutes: 7 * 60 + 30, closeMinutes: 18 * 60 + 15 }; // 7:30 AM – 6:15 PM

    it('enforces the stored times rather than the default', () => {
        expect(getExpenseWindowStatus(monday('06:30:00'), config).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('07:30:00'), config).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('17:00:00'), config).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('18:14:59'), config).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('18:15:00'), config).isOpen).toBe(false);
    });

    it('describes the same times it enforces', () => {
        const status = getExpenseWindowStatus(monday('10:00:00'), config);
        expect(status.openLabel).toBe('7:30 AM');
        expect(status.closeLabel).toBe('6:15 PM');
        expect(status.timeRange).toBe('7:30 AM and 6:15 PM');
    });

    it('counts down to the close', () => {
        expect(getExpenseWindowStatus(monday('17:45:00'), config).minutesUntilClose).toBe(30);
        expect(getExpenseWindowStatus(monday('19:00:00'), config).minutesUntilClose).toBe(0);
    });

    it('counts up to the next opening, skipping Sunday', () => {
        expect(getMsUntilExpenseWindowOpens(monday('06:30:00'), config)).toBe(60 * 60 * 1000);
        // Saturday evening → Monday 7:30 AM.
        const ms = getMsUntilExpenseWindowOpens(saturday('20:00:00'), config);
        expect(new Date(saturday('20:00:00').getTime() + ms).toISOString()).toBe('2026-08-10T07:30:00.000Z');
    });
});

describe('time formatting and parsing', () => {
    it('formats minutes as a 12-hour label', () => {
        expect(formatWindowTime(0)).toBe('12:00 AM');
        expect(formatWindowTime(360)).toBe('6:00 AM');
        expect(formatWindowTime(720)).toBe('12:00 PM');
        expect(formatWindowTime(1005)).toBe('4:45 PM');
        expect(formatWindowTime(1439)).toBe('11:59 PM');
    });

    it('round-trips through the time input format', () => {
        expect(toTimeInputValue(1005)).toBe('16:45');
        expect(parseWindowTime('16:45')).toBe(1005);
        expect(parseWindowTime('06:00')).toBe(360);
        expect(parseWindowTime('24:00')).toBeNull();
        expect(parseWindowTime('12:60')).toBeNull();
        expect(parseWindowTime('noon')).toBeNull();
    });
});

describe('validation', () => {
    it('accepts a window that opens before it closes', () => {
        expect(validateExpenseWindowConfig({ openMinutes: 360, closeMinutes: 1005 }))
            .toEqual({ ok: true, config: { openMinutes: 360, closeMinutes: 1005 } });
    });

    it('rejects a window that closes at or before it opens', () => {
        expect(validateExpenseWindowConfig({ openMinutes: 600, closeMinutes: 600 }).ok).toBe(false);
        expect(validateExpenseWindowConfig({ openMinutes: 1000, closeMinutes: 360 }).ok).toBe(false);
    });

    it('rejects times outside the day, fractions and non-numbers', () => {
        expect(validateExpenseWindowConfig({ openMinutes: -1, closeMinutes: 600 }).ok).toBe(false);
        expect(validateExpenseWindowConfig({ openMinutes: 360, closeMinutes: 1440 }).ok).toBe(false);
        expect(validateExpenseWindowConfig({ openMinutes: 360.5, closeMinutes: 600 }).ok).toBe(false);
        expect(validateExpenseWindowConfig({ openMinutes: '360', closeMinutes: 600 }).ok).toBe(false);
        expect(validateExpenseWindowConfig(null).ok).toBe(false);
    });
});
