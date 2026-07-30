import { describe, it, expect } from 'vitest';
import {
    transactionTypeLabel,
    transactionColumnLabel,
    transactionStatusLabel,
    decisionLabel,
    roleLabel,
} from './labels';

describe('transaction vocabulary', () => {
    it('uses Deposit / Withdrawal by default', () => {
        expect(transactionTypeLabel('INCOME')).toBe('Deposit');
        expect(transactionTypeLabel('EXPENSE')).toBe('Withdrawal');
    });

    it('uses Credit / Debit only for accounting columns', () => {
        expect(transactionColumnLabel('INCOME')).toBe('Credit');
        expect(transactionColumnLabel('EXPENSE')).toBe('Debit');
    });

    it('never leaks a raw enum for status', () => {
        for (const s of ['PENDING', 'APPROVED', 'REJECTED']) {
            const label = transactionStatusLabel(s);
            expect(label).not.toBe(s);
            expect(label).toMatch(/^[A-Z][a-z]+$/);
        }
    });

    it('keeps the status word and the button verb consistent', () => {
        // The old bug: filter said "Declined", badge said "REJECTED", button said "Reject".
        expect(transactionStatusLabel('REJECTED')).toBe('Declined');
        expect(decisionLabel('reject')).toBe('Decline');
    });

    it('falls back to the input for unknown values rather than blanking', () => {
        expect(transactionStatusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
        expect(transactionTypeLabel('WEIRD')).toBe('WEIRD');
    });
});

describe('role vocabulary', () => {
    it('renders admins as managers and leaders as leaders', () => {
        expect(roleLabel('CAMPUS_ADMIN')).toBe('Campus manager');
        expect(roleLabel('CAMPUS_LEADER')).toBe('Campus leader');
    });

    it('names COUNCIL_LEADER by what they actually are', () => {
        expect(roleLabel('COUNCIL_LEADER')).toBe('Account holder');
    });

    it('is case-insensitive and safe when empty', () => {
        expect(roleLabel('campus_admin')).toBe('Campus manager');
        expect(roleLabel(null)).toBe('');
        expect(roleLabel(undefined)).toBe('');
    });
});
