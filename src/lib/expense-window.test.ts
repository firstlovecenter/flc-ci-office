/**
 * The withdrawal-submission window.
 *
 * The closing time has moved more than once, and each move risks leaving the
 * boundary and the copy describing it out of step. These pin both: 6:00 AM to
 * 3:00 PM, Monday to Saturday, evaluated in UTC (Ghana time, no offset).
 */
import { describe, it, expect } from 'vitest';
import {
    getExpenseWindowStatus,
    EXPENSE_WINDOW_OPEN_HOUR,
    EXPENSE_WINDOW_CLOSE_HOUR,
    EXPENSE_WINDOW_CLOSE_MINUTE,
    EXPENSE_WINDOW_TIME_RANGE,
    EXPENSE_WINDOW_CLOSE_LABEL,
} from './expense-window';

/** 2026-08-03 is a Monday; 2026-08-09 a Sunday. */
const monday = (time: string) => new Date(`2026-08-03T${time}Z`);
const saturday = (time: string) => new Date(`2026-08-08T${time}Z`);
const sunday = (time: string) => new Date(`2026-08-09T${time}Z`);

describe('expense window boundaries', () => {
    it('closes at 3:00 PM, not 3:30', () => {
        expect(EXPENSE_WINDOW_CLOSE_HOUR).toBe(15);
        expect(EXPENSE_WINDOW_CLOSE_MINUTE).toBe(0);
        expect(getExpenseWindowStatus(monday('14:59:59')).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('15:00:00')).isOpen).toBe(false);
        // The half hour that used to be inside the window is now outside it.
        expect(getExpenseWindowStatus(monday('15:29:00')).isOpen).toBe(false);
    });

    it('opens at 6:00 AM', () => {
        expect(EXPENSE_WINDOW_OPEN_HOUR).toBe(6);
        expect(getExpenseWindowStatus(monday('05:59:59')).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('06:00:00')).isOpen).toBe(true);
    });

    it('is open through the working day and shut overnight', () => {
        expect(getExpenseWindowStatus(monday('11:30:00')).isOpen).toBe(true);
        expect(getExpenseWindowStatus(monday('23:00:00')).isOpen).toBe(false);
        expect(getExpenseWindowStatus(monday('03:00:00')).isOpen).toBe(false);
    });

    it('runs Monday to Saturday but never on Sunday', () => {
        expect(getExpenseWindowStatus(saturday('10:00:00')).isOpen).toBe(true);

        const shut = getExpenseWindowStatus(sunday('10:00:00'));
        expect(shut.isSunday).toBe(true);
        expect(shut.isOpen).toBe(false);
    });
});

describe('expense window copy', () => {
    it('describes the same closing time the check enforces', () => {
        expect(EXPENSE_WINDOW_CLOSE_LABEL).toBe('3:00 PM');
        expect(EXPENSE_WINDOW_TIME_RANGE).toBe('6:00 AM and 3:00 PM');
        expect(getExpenseWindowStatus(monday('10:00:00')).timeRange).toBe(EXPENSE_WINDOW_TIME_RANGE);
    });
});
