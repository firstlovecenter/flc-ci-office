/**
 * Rules for closing a bank account that still holds money.
 *
 * The invariant these pin down: an account with a positive balance never closes
 * without a disposition that posts it to zero, and the balance can only land in
 * an open operating account.
 */
import { describe, it, expect } from 'vitest';
import {
    holdsClosingBalance,
    isOverdrawn,
    accountClosureBlockers,
    accountClosureWarnings,
    validateClosurePlan,
    validateTransferDestination,
    type ClosureContext,
    type DestinationAccount,
} from './account-closure';

const account = (over: Partial<ClosureContext> = {}): ClosureContext => ({
    isAccount: true,
    accountType: 'OPERATING',
    balanceMinor: 0,
    pendingCount: 0,
    ...over,
});

describe('holdsClosingBalance', () => {
    it('is true only for an account with money left on it', () => {
        expect(holdsClosingBalance(account({ balanceMinor: 5000 }))).toBe(true);
        expect(holdsClosingBalance(account({ balanceMinor: 1 }))).toBe(true);
        expect(holdsClosingBalance(account({ balanceMinor: 0 }))).toBe(false);
        expect(holdsClosingBalance(account({ balanceMinor: -5000 }))).toBe(false);
    });

    it('is false for special-project accounts, which hold no balance', () => {
        expect(holdsClosingBalance(account({ accountType: 'SPECIAL_PROJECT', balanceMinor: 5000 }))).toBe(false);
    });

    it('is false for churches — they never hold money', () => {
        expect(holdsClosingBalance(account({ isAccount: false, balanceMinor: 5000 }))).toBe(false);
    });
});

describe('isOverdrawn', () => {
    it('flags a negative operating balance only', () => {
        expect(isOverdrawn(account({ balanceMinor: -1 }))).toBe(true);
        expect(isOverdrawn(account({ balanceMinor: 0 }))).toBe(false);
        // Special projects are expense-only, so a negative net is normal.
        expect(isOverdrawn(account({ accountType: 'SPECIAL_PROJECT', balanceMinor: -5000 }))).toBe(false);
    });
});

describe('accountClosureBlockers', () => {
    it('blocks while transactions are awaiting approval', () => {
        expect(accountClosureBlockers(account({ pendingCount: 2 }))[0]).toMatch(/2 transactions awaiting approval/);
        expect(accountClosureBlockers(account({ pendingCount: 1 }))[0]).toMatch(/1 transaction awaiting approval/);
    });

    it('does not block a clean account', () => {
        expect(accountClosureBlockers(account({ balanceMinor: 9999 }))).toEqual([]);
    });

    it('leaves church closure rules alone', () => {
        expect(accountClosureBlockers(account({ isAccount: false, pendingCount: 3 }))).toEqual([]);
    });
});

describe('accountClosureWarnings', () => {
    it('warns that a remaining balance has to be dealt with', () => {
        expect(accountClosureWarnings(account({ balanceMinor: 2500 })).join(' ')).toMatch(/transferred|withdrawn/);
    });

    it('warns that an overdrawn account keeps its shortfall', () => {
        expect(accountClosureWarnings(account({ balanceMinor: -2500 })).join(' ')).toMatch(/overdrawn/i);
    });

    it('says nothing about an empty account', () => {
        expect(accountClosureWarnings(account())).toEqual([]);
    });
});

describe('validateClosurePlan', () => {
    it('refuses to close an account that still holds money with no disposition', () => {
        const result = validateClosurePlan(account({ balanceMinor: 10000 }), {});
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toMatch(/still holds money/);
    });

    it('sweeps the full balance on transfer', () => {
        const result = validateClosurePlan(account({ balanceMinor: 10000 }), {
            disposition: 'TRANSFER',
            destinationAccountId: 'dest-1',
        });
        expect(result).toEqual({
            ok: true,
            plan: { disposition: 'TRANSFER', amountMinor: 10000, destinationAccountId: 'dest-1' },
        });
    });

    it('rejects a transfer with no destination chosen', () => {
        const result = validateClosurePlan(account({ balanceMinor: 10000 }), { disposition: 'TRANSFER', destinationAccountId: '  ' });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toMatch(/Choose the account/);
    });

    it('sweeps the full balance on withdrawal', () => {
        const result = validateClosurePlan(account({ balanceMinor: 750 }), { disposition: 'WITHDRAW' });
        expect(result).toEqual({
            ok: true,
            plan: { disposition: 'WITHDRAW', amountMinor: 750, destinationAccountId: null },
        });
    });

    it('closes an empty account with no movement', () => {
        const result = validateClosurePlan(account(), {});
        expect(result).toEqual({
            ok: true,
            plan: { disposition: 'NONE', amountMinor: 0, destinationAccountId: null },
        });
    });

    it('refuses to move money that is not there', () => {
        const result = validateClosurePlan(account(), { disposition: 'WITHDRAW' });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toMatch(/no remaining balance/);
    });

    it('closes an overdrawn account without a disposition', () => {
        const result = validateClosurePlan(account({ balanceMinor: -4000 }), {});
        expect(result.ok).toBe(true);
        expect(result.ok === true && result.plan.disposition).toBe('NONE');
    });

    it('closes a special-project account without a disposition', () => {
        const ctx = account({ accountType: 'SPECIAL_PROJECT', balanceMinor: -80000 });
        expect(validateClosurePlan(ctx, {}).ok).toBe(true);
    });

    it('refuses any disposition while transactions are pending', () => {
        const result = validateClosurePlan(account({ balanceMinor: 10000, pendingCount: 1 }), { disposition: 'WITHDRAW' });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toMatch(/awaiting approval/);
    });

    it('does not let a church closure carry a disposition', () => {
        const result = validateClosurePlan(account({ isAccount: false }), { disposition: 'WITHDRAW' });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toMatch(/Only bank accounts/);
    });
});

describe('validateTransferDestination', () => {
    const dest: DestinationAccount = {
        id: 'dest-1', name: 'Area 4', level: 'COUNCIL', accountType: 'OPERATING', isActive: true,
    };

    it('accepts an open operating account', () => {
        expect(validateTransferDestination('src-1', dest)).toEqual({ ok: true });
    });

    it('rejects the account being closed', () => {
        const result = validateTransferDestination('dest-1', dest);
        expect(result.ok === false && result.error).toMatch(/account being closed/);
    });

    it('rejects a missing account', () => {
        expect(validateTransferDestination('src-1', null).ok).toBe(false);
    });

    it('rejects a church', () => {
        const result = validateTransferDestination('src-1', { ...dest, level: 'CAMPUS', accountType: null });
        expect(result.ok === false && result.error).toMatch(/another bank account/);
    });

    it('rejects an already-closed account', () => {
        const result = validateTransferDestination('src-1', { ...dest, isActive: false });
        expect(result.ok === false && result.error).toMatch(/closed/);
    });

    it('rejects a special-project account, which holds no balance', () => {
        const result = validateTransferDestination('src-1', { ...dest, accountType: 'SPECIAL_PROJECT' });
        expect(result.ok === false && result.error).toMatch(/does not hold a balance/);
    });
});
