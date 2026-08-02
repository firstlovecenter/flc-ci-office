/**
 * Running-balance arithmetic for a page of the ledger.
 *
 * The ledger is paginated newest-first, so a page cannot see the entries above
 * or below it. Each page is therefore anchored on an *opening balance* supplied
 * by the API — the net of every approved entry older than the page's oldest row
 * — and accumulates upward from there.
 *
 * The anchor used to be derived from the account's total balance instead, which
 * only held on page one: from page two on it ignored the newer pages sitting
 * above and every row was out by their net. Totals were never affected — those
 * come from an aggregate over the whole scope — but the column disagreed with
 * the account, which is worse than showing nothing.
 *
 * Money is handled in integer minor units; only the final value is divided back
 * down, so a page of entries cannot accumulate float drift.
 */

export interface LedgerRow {
    id: string;
    status: string;
    type: 'INCOME' | 'EXPENSE' | string;
    amount: number | string;
    amountInBase?: number | string | null;
}

/**
 * Balance after each row, keyed by row id.
 *
 * @param rows Page of entries, newest first — the order the API returns.
 * @param openingBalance Net of everything older than the last row in `rows`.
 */
export function runningBalances(rows: LedgerRow[], openingBalance: number): Map<string, number> {
    const balances = new Map<string, number>();
    if (!rows.length) return balances;

    // Accumulate from the oldest row upward: balance after row i is the opening
    // balance plus every entry from the bottom of the page up to and including i.
    const cumulative = new Array<number>(rows.length);
    let acc = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        // Pending and declined entries sit in the list but have not moved money.
        if (row.status === 'APPROVED') {
            const cents = Math.round(Number(row.amountInBase ?? row.amount) * 100);
            acc += row.type === 'INCOME' ? cents : -cents;
        }
        cumulative[i] = acc;
    }

    const openingCents = Math.round(openingBalance * 100);
    for (let i = 0; i < rows.length; i++) {
        balances.set(rows[i].id, (cumulative[i] + openingCents) / 100);
    }
    return balances;
}

/**
 * Whether a running balance can be shown at all under the current filters.
 *
 * The column is only arithmetic if every entry between two visible rows is also
 * visible. Type and free-text filters hide entries in the middle, so the column
 * would accumulate a subset and quietly disagree with the account. Filtering by
 * status is safe at ALL or APPROVED — pending and declined entries never move
 * the balance, so hiding them changes nothing.
 */
export function canShowRunningBalance(filters: {
    type: string;
    status: string;
    search: string;
}): boolean {
    return (
        filters.type === 'ALL' &&
        !filters.search.trim() &&
        (filters.status === 'ALL' || filters.status === 'APPROVED')
    );
}
