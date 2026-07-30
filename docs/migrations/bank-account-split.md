# Bank-account split — migration state

Separating bank accounts out of the `Organisation` table, so they stop being
sub-units of a campus and become their own entity linked to one.

Run as **expand → migrate → contract**. Expand and dual-write are done and live;
migrate and contract are not started.

---

## Why

Bank accounts were stored as `Organisation` rows with `level = 'COUNCIL'` and a
`parentId` pointing at a campus, which made them children in the church
hierarchy. They are not a church level — campuses are the lowest one. The
conflation caused real defects, e.g. the accounts list showed "17 bank accounts"
for Revival because `_count.children` counted four dead `STREAM` rows too.

## Safety apparatus

Built before any structural change, and the reason this is verifiable:

| Tool | Command | Purpose |
| --- | --- | --- |
| Scope baseline | `npm run snapshot:verify` | Recomputes every balance and subtree in SQL and diffs against a recorded baseline. Exits 1 on drift. |
| Backup | `node scripts/backup-db.mjs` | Full JSON dump with SHA-256 checksum and balance anchors. |
| Unit tests | `npm test` | Characterisation tests pinning the org/account boundary and role gating. |

The baseline is keyed by **business identity** (`LEVEL|name|parent`), never row
id or table shape — which is what lets one baseline validate the schema both
before and after accounts move out of `Organisation`.

**Re-capture the baseline only after a change you have already confirmed is
correct.** Capturing to make a failure go away destroys the safety net.

## Phase 1 — EXPAND ✅ done

`20260730201500_bank_account_expand`

- Created `BankAccount` (`id`, `name`, `campusId`, `accountType`, `isActive`, closure fields).
- Copied all 19 `COUNCIL` rows across **preserving ids**, so dependent foreign
  keys are a value copy rather than a remap — and the change stays reversible.
- Added nullable `bankAccountId` to `Transaction`, `UserRole`, `User` and
  back-filled: 2,202 / 19 / 14 rows.
- The legacy `COUNCIL` rows remain. The application still reads
  `organisationId` exclusively, so behaviour is unchanged — confirmed by the
  baseline verifying clean immediately afterwards.

Data surface turned out to be only three tables. `OrganisationBaseCurrency`,
`PublicExpenseRequest` and child rows all referenced accounts zero times.

## Phase 2 — DUAL-WRITE ✅ done

`20260730202000_bank_account_dualwrite`

A `BEFORE INSERT OR UPDATE` trigger on `Transaction`, `UserRole` and `User`
copies `organisationId` into `bankAccountId` whenever the target is an account.

Chosen over editing the 8 `transaction.create` call sites because a trigger
cannot be forgotten by a new code path, and it also covers migrations and manual
SQL. Verified by inserting a probe row the old way and confirming the column
populated (probe rolled back).

**This is what makes it safe to run the site while the migration is unfinished.**
No backfill debt accumulates.

## Phase 3 — MIGRATE ⬜ not started

Switch application reads from `organisationId` to `bankAccountId` / `campusId`.

The one genuinely dangerous change: `getDescendantOrganisationIds` currently
returns account ids as part of a campus subtree, and ~39 call sites rely on it.
Once `COUNCIL` rows leave `Organisation`, the recursive CTE stops finding them
and every scope query silently under-reports.

Change it **once, centrally** — return org-unit ids plus account ids sourced
from `BankAccount` — and run `npm run snapshot:verify` immediately. Do not edit
call sites piecemeal.

Can be done with the site open, since both columns stay in sync.

## Phase 4 — CONTRACT ⬜ not started

Needs a short maintenance window.

1. Delete the 19 `COUNCIL` rows from `Organisation`.
2. Drop the three sync triggers and `sync_bank_account_id()`.
3. Make `Transaction.bankAccountId` non-null; drop `Transaction.organisationId`.
4. Remove `COUNCIL` and `STREAM` from the `OrganisationLevel` enum.
5. Delete `isBankAccount()` and the `MONEY_BEARING_LEVEL` indirection.

## Maintenance gate

`MAINTENANCE_MODE=1` in **Vercel's** environment (not `.env`, which is local
only) closes the site at the edge — including `/auth/login` and the
unauthenticated `/api/public-expense`, both of which would otherwise stay open.
`?bypass=<MAINTENANCE_BYPASS>` sets a cookie to get in.

JWT sessions cannot be revoked server-side, so edge blocking is the only
reliable way to hold the database still.

## Known trap

`npx prisma migrate dev` **cannot run on this repo**. The shadow-database replay
fails on a pre-existing broken migration —
`20260730140000_rename_department_to_organisation` runs
`UPDATE "Transaction" ... FROM "Currency"` before `Currency` exists.

Until that is repaired, migrations must be hand-written, applied inside an
explicit transaction with assertions before `COMMIT`, then registered with
`npx prisma migrate resolve --applied <name>`.

## Related cleanup done alongside

- Removed 4 deprecated `STREAM` rows (all inactive, zero dependants). Verified
  no balance or transaction-count change.
- Repaired two accounts stranded by the earlier stream migration, one of which
  could not authenticate at all.
- Relocated 2 oversight-level transactions onto a new `OA - Camp` account, so
  every transaction now sits on a bank account.
