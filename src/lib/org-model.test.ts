/**
 * Characterisation tests for the org-unit / bank-account boundary.
 *
 * These lock in current behaviour ahead of splitting bank accounts out of the
 * Organisation table. Every assertion here must still hold afterwards — if the
 * split changes one of these answers, that is a behaviour change to justify,
 * not a test to edit away.
 */
import { describe, it, expect } from 'vitest';
import {
    isOrgUnit,
    isBankAccount,
    canRecordDeposit,
    hasAccountBalance,
    isExpenseWindowExempt,
    validateParentChild,
    validateAccountTypeForLevel,
    getExpectedParentLevel,
    ORG_UNIT_LEVELS,
    MONEY_BEARING_LEVEL,
} from './org-model';

describe('org unit vs bank account', () => {
    it('treats exactly the three church levels as org units', () => {
        expect(ORG_UNIT_LEVELS).toEqual(['DENOMINATION', 'OVERSIGHT', 'CAMPUS']);
        for (const level of ORG_UNIT_LEVELS) expect(isOrgUnit(level)).toBe(true);
    });

    it('treats only COUNCIL as a bank account', () => {
        expect(isBankAccount('COUNCIL')).toBe(true);
        expect(MONEY_BEARING_LEVEL).toBe('COUNCIL');
        for (const level of ORG_UNIT_LEVELS) expect(isBankAccount(level)).toBe(false);
    });

    it('classifies STREAM as neither — it is renderable nowhere', () => {
        expect(isOrgUnit('STREAM')).toBe(false);
        expect(isBankAccount('STREAM')).toBe(false);
    });

    it('classifies null and undefined as neither', () => {
        for (const v of [null, undefined, '']) {
            expect(isOrgUnit(v)).toBe(false);
            expect(isBankAccount(v)).toBe(false);
        }
    });

    it('never classifies a level as both', () => {
        for (const level of ['DENOMINATION', 'OVERSIGHT', 'CAMPUS', 'STREAM', 'COUNCIL', null]) {
            expect(isOrgUnit(level) && isBankAccount(level)).toBe(false);
        }
    });
});

describe('account type behaviour', () => {
    it('OPERATING accounts take deposits, hold a balance, and obey the expense window', () => {
        expect(canRecordDeposit('OPERATING')).toBe(true);
        expect(hasAccountBalance('OPERATING')).toBe(true);
        expect(isExpenseWindowExempt('OPERATING')).toBe(false);
    });

    it('SPECIAL_PROJECT accounts are withdrawal-only, balance-less, and window-exempt', () => {
        expect(canRecordDeposit('SPECIAL_PROJECT')).toBe(false);
        expect(hasAccountBalance('SPECIAL_PROJECT')).toBe(false);
        expect(isExpenseWindowExempt('SPECIAL_PROJECT')).toBe(true);
    });

    it('defaults an unset account type to OPERATING behaviour', () => {
        // Matters because the transaction form reads accountType before the
        // account list has loaded.
        for (const v of [null, undefined]) {
            expect(canRecordDeposit(v)).toBe(true);
            expect(hasAccountBalance(v)).toBe(true);
            expect(isExpenseWindowExempt(v)).toBe(false);
        }
    });
});

describe('hierarchy shape', () => {
    it('places each level under its expected parent', () => {
        expect(getExpectedParentLevel('DENOMINATION')).toBeNull();
        expect(getExpectedParentLevel('OVERSIGHT')).toBe('DENOMINATION');
        expect(getExpectedParentLevel('CAMPUS')).toBe('OVERSIGHT');
        expect(getExpectedParentLevel('COUNCIL')).toBe('CAMPUS');
    });

    it('accepts the four valid parent/child pairs', () => {
        expect(validateParentChild('DENOMINATION', null).ok).toBe(true);
        expect(validateParentChild('OVERSIGHT', 'DENOMINATION').ok).toBe(true);
        expect(validateParentChild('CAMPUS', 'OVERSIGHT').ok).toBe(true);
        expect(validateParentChild('COUNCIL', 'CAMPUS').ok).toBe(true);
    });

    it('rejects an account hanging off anything but a campus', () => {
        expect(validateParentChild('COUNCIL', 'OVERSIGHT').ok).toBe(false);
        expect(validateParentChild('COUNCIL', 'DENOMINATION').ok).toBe(false);
        expect(validateParentChild('COUNCIL', null).ok).toBe(false);
    });

    it('rejects a campus directly under HQ', () => {
        expect(validateParentChild('CAMPUS', 'DENOMINATION').ok).toBe(false);
    });
});

describe('account type is only meaningful on accounts', () => {
    it('accepts a type on a COUNCIL row', () => {
        expect(validateAccountTypeForLevel('COUNCIL', 'OPERATING').ok).toBe(true);
        expect(validateAccountTypeForLevel('COUNCIL', 'SPECIAL_PROJECT').ok).toBe(true);
    });

    it('rejects a type on an org unit', () => {
        for (const level of ORG_UNIT_LEVELS) {
            expect(validateAccountTypeForLevel(level, 'OPERATING').ok).toBe(false);
        }
    });
});
