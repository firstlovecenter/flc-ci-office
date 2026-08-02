/**
 * Paging must not change what the ledger says the balance is.
 *
 * The regression these pin: page two used to anchor on the account total rather
 * than the page's opening balance, so every row on it was out by the net of the
 * pages above.
 */
import { describe, it, expect } from 'vitest';
import { runningBalances, canShowRunningBalance, type LedgerRow } from './ledger';

const row = (id: string, type: 'INCOME' | 'EXPENSE', amount: number, status = 'APPROVED'): LedgerRow =>
    ({ id, type, amount, status });

describe('runningBalances', () => {
    it('accumulates upward from the opening balance, newest row highest', () => {
        // Newest first: +200, −50, +100 on an account that already held 1,000.
        const rows = [row('c', 'INCOME', 200), row('b', 'EXPENSE', 50), row('a', 'INCOME', 100)];
        const balances = runningBalances(rows, 1000);

        expect(balances.get('a')).toBe(1100);
        expect(balances.get('b')).toBe(1050);
        expect(balances.get('c')).toBe(1250);
    });

    it('gives the same answer for a row whichever page it lands on', () => {
        const all = [
            row('e', 'INCOME', 40), row('d', 'EXPENSE', 30), row('c', 'INCOME', 20),
            row('b', 'EXPENSE', 10), row('a', 'INCOME', 100),
        ];
        const oneBigPage = runningBalances(all, 0);

        // Split into two pages. Page two opens at 0; page one opens at the net
        // of everything below it — which is exactly page two's top row.
        const pageTwo = runningBalances(all.slice(2), 0);
        const pageOne = runningBalances(all.slice(0, 2), pageTwo.get('c')!);

        for (const id of ['a', 'b', 'c']) expect(pageTwo.get(id)).toBe(oneBigPage.get(id));
        for (const id of ['d', 'e']) expect(pageOne.get(id)).toBe(oneBigPage.get(id));
    });

    it('ignores pending and declined entries — they have not moved money', () => {
        const rows = [
            row('c', 'EXPENSE', 500, 'PENDING'),
            row('b', 'EXPENSE', 999, 'REJECTED'),
            row('a', 'INCOME', 100),
        ];
        const balances = runningBalances(rows, 0);

        expect(balances.get('a')).toBe(100);
        expect(balances.get('b')).toBe(100);
        expect(balances.get('c')).toBe(100);
    });

    it('prefers amountInBase when the entry carries one', () => {
        const rows: LedgerRow[] = [{ id: 'a', type: 'INCOME', amount: 1, amountInBase: 250, status: 'APPROVED' }];
        expect(runningBalances(rows, 0).get('a')).toBe(250);
    });

    it('does not drift on amounts that float arithmetic rounds badly', () => {
        const rows = Array.from({ length: 30 }, (_, i) => row(`r${i}`, 'INCOME', 0.1));
        expect(runningBalances(rows, 0).get('r0')).toBe(3);
    });

    it('handles a negative opening balance and an empty page', () => {
        expect(runningBalances([row('a', 'EXPENSE', 25)], -100).get('a')).toBe(-125);
        expect(runningBalances([], 500).size).toBe(0);
    });
});

describe('canShowRunningBalance', () => {
    const unfiltered = { type: 'ALL', status: 'ALL', search: '' };

    it('shows on the unfiltered ledger', () => {
        expect(canShowRunningBalance(unfiltered)).toBe(true);
    });

    it('shows when filtering to approved — hidden entries move no money', () => {
        expect(canShowRunningBalance({ ...unfiltered, status: 'APPROVED' })).toBe(true);
    });

    it('hides when entries in between are filtered out', () => {
        expect(canShowRunningBalance({ ...unfiltered, type: 'EXPENSE' })).toBe(false);
        expect(canShowRunningBalance({ ...unfiltered, search: 'fuel' })).toBe(false);
        expect(canShowRunningBalance({ ...unfiltered, status: 'PENDING' })).toBe(false);
        expect(canShowRunningBalance({ ...unfiltered, status: 'REJECTED' })).toBe(false);
    });

    it('ignores whitespace typed into the search box', () => {
        expect(canShowRunningBalance({ ...unfiltered, search: '   ' })).toBe(true);
    });
});
