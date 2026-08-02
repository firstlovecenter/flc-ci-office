# Ledger pagination and where balances come from

The ledger is paged; balances are not. The rule this page exists to protect:

> **A page of rows must never be the source of a balance.**

Every figure a user acts on — the balance card, an account's spendable balance,
report totals — is an aggregate over the whole scope. A page only ever decides
which rows are *displayed*.

## The two endpoints

| Endpoint | Returns | Capped? |
| --- | --- | --- |
| `GET /api/transactions?page=N` | `{ items, total, page, pageSize, openingBalance }` | yes — `pageSize`, max 200 |
| `GET /api/transactions` (no `page`) | plain array | **yes — 500 rows** |
| `GET /api/transactions/summary` | `{ income, expense, balance }` | no — aggregates the scope |
| `GET /api/organisations/[id]/stats` | balance, income, expense, chart | no |

The 500-row cap on the unpaginated form is the trap. It is not an error, it is a
silent truncation: a caller that sums what it received gets a number that looks
plausible and is wrong. Anything that needs a total must use `summary` or
`stats`, or page through with `?page=`.

## Opening balance

The running-balance column accumulates upward from the oldest row on screen, so
each page needs to know what came before it. The API computes that as the net of
every APPROVED entry older than the page's oldest row, over the same scope —
an aggregate, never a sum of the fetched rows.

The comparison is on the **full sort key**, `("createdAt", id) < (…)`, not
`createdAt` alone. Entries backdated from the date picker share a midnight
timestamp — 51 collisions on one account — and a plain `createdAt <` dropped
every same-timestamp sibling, so the pages stopped chaining.

`runningBalances()` in `src/lib/ledger.ts` does the accumulation, in integer
minor units, anchored on that opening balance. Anchoring on the account total
instead only works on page one; from page two it ignores the newer pages above
and every row is out by their net.

## When the column is hidden

`canShowRunningBalance()` — a running balance is only arithmetic if every entry
between two visible rows is also visible. The type and search filters hide
entries in the middle, so the column shows `—` instead of a number that would
disagree with the account. Filtering by status is safe at `ALL` or `APPROVED`:
pending and declined entries never move the balance.

## Known equivalence

The opening-balance SQL sums `COALESCE("amountInBase", amount)`, while the rows
on screen carry an `amountInBase` recomputed from exchange rates. These agree
because the app is single-currency (GHS, `APP_CURRENCY`). If a second live
currency is ever introduced, the two paths have to be reconciled before the
running balance can be trusted.
