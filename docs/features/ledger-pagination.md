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

## Exports

Three of them, and they must agree with the screen and with each other.

| Export | Source | Capped? |
| --- | --- | --- |
| Statement CSV (reports page) | pages through `?page=` until the set is complete | no |
| Trends CSV (reports page) | same rows, bucketed by ISO week | no |
| PDF statement (`/api/reports/pdf`) | queries Prisma directly, server-side | refuses above 5,000 rows |
| On-screen report | same fetch as the CSV | no |

**Every export states an opening and a closing balance.** The statement CSV
brackets its entries with them, the trends CSV gives each period its own pair
plus a totals row carrying the statement's, and the PDF prints them above and
below the table. A movement without a balance either side of it cannot be
reconciled against the account, which is the whole point of an export.

There is no Excel (`.xlsx`) export — the CSV is what people open in Excel, which
is why it is built through `lib/csv.ts` rather than by joining strings:

- **Every text field is quoted.** Descriptions are free text and routinely
  contain commas. An unquoted one shifts every column after it, so the debit
  lands in the credit column and the balance somewhere else again. The file
  still opens; the numbers are just wrong.
- **Formula-leading text is defused.** Excel evaluates a cell whose text starts
  `=`, `+`, `-`, `@`, tab or CR — quoted or not — so such values get Excel's own
  apostrophe text-marker. Numbers are emitted bare, so a negative amount is
  never mistaken for a formula and columns stay summable.
- **The file is BOM-marked UTF-8.** Without it Excel reads the local codepage
  and mangles em dashes (transfer and closure descriptions contain them),
  accented names and the cedi sign.
- **It carries opening and closing balance rows.** The running column is
  meaningless if you cannot see what it started from; with them the export
  reconciles against the account on its own.
- **Dates are ISO.** `toLocaleDateString()` produced `8/2/2026` or `02/08/2026`
  depending on who pressed the button.

The running balance accumulates in integer minor units, so a long statement
cannot drift a cent the way repeated float addition does.

### The PDF and WinAnsi

pdf-lib's standard fonts encode WinAnsi and **throw** on anything outside it —
`WinAnsi cannot encode "…"` aborts the request, so one bad character takes down
the whole export. Two traps:

- `widthOfTextAtSize` throws on tab, newline and carriage return even where
  `drawText` tolerates them, and every centred, aligned or wrapped string is
  measured before it is drawn. A description with a line break in it was enough.
- The 57 unencodable codepoints below 0x100 are exactly the C0 controls and
  0x7F–0x9F — where Windows-1252 text pasted from Word puts its curly quotes.

`lib/pdf-text.ts` maps what has an equivalent and drops the rest. Its tests feed
the output back to pdf-lib and assert it never refuses, including every
codepoint below 0x100 one at a time. The old inline sanitiser stripped
`[^\x00-\xFF]`, which removed the harmless astral characters and kept every
dangerous one.

## Known equivalence

The opening-balance SQL sums `COALESCE("amountInBase", amount)`, while the rows
on screen carry an `amountInBase` recomputed from exchange rates. These agree
because the app is single-currency (GHS, `APP_CURRENCY`). If a second live
currency is ever introduced, the two paths have to be reconciled before the
running balance can be trusted.
