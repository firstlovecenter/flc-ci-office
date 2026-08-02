# Closing an account

Closing a bank account retires it from the app: the holder loses access, the
account stops appearing in lists, and its transaction history is preserved. The
one thing closure cannot do is make money disappear — an account that still
holds a balance closes only once that balance has been posted somewhere.

## The disposition

Every closure of an account with money left on it carries a **funds
disposition**:

| Disposition | What is posted |
| --- | --- |
| `TRANSFER` | Two paired legs — a withdrawal on the closing account and a matching deposit on the receiving account, sharing one `transferId` |
| `WITHDRAW` | A single withdrawal on the closing account, recording that the money was taken out of the bank |
| `NONE` | Nothing. Only valid when there is nothing to move |

Either movement posts the account to **exactly zero** before it closes, so the
balance leaves through the ledger rather than vanishing with the row. Both are
APPROVED immediately: this is an administrative reallocation by someone who
already controls the account, not a spending request, so it does not enter the
approval queue.

### What each entry reads

The two legs of a closing transfer carry **different** descriptions
(`closureTransferDescriptions`), because they answer different questions:

| Where | Description |
| --- | --- |
| Closing account | `TRANSFER: Closing balance moved to <destination> — <reason>` |
| Receiving account | `BALANCE BROUGHT FORWARD: from <closed account>` |

The receiving side leads with *what the money is*, not where it came from. On an
account opened to replace the closed one this is the opening line of its ledger,
and "balance brought forward" is what a bookkeeper expects to read there. The
ledger sorts newest-first, so the entry sits at the top of the new account from
the moment it posts — and on an account with no other activity it is the whole
ledger.

A withdrawal posts one entry:
`CLOSURE WITHDRAWAL: Remaining balance of <account> withdrawn — <reason>`.

The sweep legs are flagged `receiptWaived` — a ledger movement made by an
administrator has no receipt to collect, and without the waiver the closing
admin would be blocked from filing their own requests 24 hours later.

## Rules

Decided in `src/lib/account-closure.ts` (pure, unit-tested) and enforced in
`POST /api/organisations/[id]/close`:

- **Pending transactions block closure.** Approving a request after the account
  closed would move money on an account nobody is watching. Approve or decline
  them first.
- **A positive balance requires a disposition.** No disposition, no closure.
- **Transfers only reach open operating accounts** the closer also controls —
  the same two-ended permission check ordinary transfers use. Special-project
  accounts hold no balance and can neither send nor receive.
- **Special-project accounts need no disposition.** Their net position is
  expenditure, not money on hand.
- **Overdrawn accounts still close**, with a warning. There is nothing to move,
  and the shortfall stays on the record.

The balance and pending count are re-read on the server at closing time. The
preflight the dialog rendered may be minutes stale, and the client's numbers are
never trusted.

## Atomicity

The sweep, the role removals, the closure and the audit entries all run inside
one `prisma.$transaction`. Either the money moves and the account closes, or
neither happens — a half-swept closure would strand money on an account no one
can reach.

The closure is mirrored onto the `BankAccount` row (`isActive`, `closedAt`,
`closedBy`, `closureReason`). The dual-write trigger from the bank-account split
covers `Transaction` / `UserRole` / `User` only, so closure state would
otherwise drift between the two tables. See
[Bank-account split](../migrations/bank-account-split.md).

## Who gets told

Everyone holding a role on the account when it closed — holder and manager
alike — gets an **SMS and an email**. They are the people who just lost access
and who were responsible for the balance, and the first question on losing
access is where the money went, so both messages carry the same two facts:

- the account is closed, and access to it has been removed
- what happened to the balance — transferred to a named account, withdrawn, or
  nothing left to move

The funds line comes from `closureFundsSummary`, shared by both channels so they
can never say different things. Contact details are read **before** the roles are
deleted, since afterwards there is nothing linking those people to the account.

Delivery is best-effort and happens after the commit: a closure stands whether
or not a message goes out, and a failed SMS must never roll back a posted
transfer. The receiving account's holder separately gets the usual transfer
alert.

Accounts only. Closing a church removes roles too, but wording about a balance
and where it went does not apply, so that path is unchanged.

## After closure

A closed account stays in the accounts list — faded, struck through, badged
`Closed`, and sorted below every open account, with the closing date and reason
where the holder's name would be. Removing it from the list would hide the fact
that money was once banked there, which is exactly what someone auditing a
campus needs to see.

The row is inert: no click-through to a dashboard, no edit, no transfer. It
holds nothing and nobody holds it. The list fetches
`/api/organisations?all=true&includeClosed=true`; that flag now also widens the
scope walk to the inactive tree, since closed rows are pruned from the active
one and non-superadmins would otherwise get nothing extra back.

## Reopening

Campus managers open accounts and close them. **Reopening is oversight and HQ
only** (`canReopenAccount` — `OVERSIGHT_ADMIN`, `DENOMINATION_ADMIN`,
`SUPERADMIN`), because it restores a money-bearing account someone deliberately
retired. Scope applies on top: the reopener must control the campus the account
hangs off.

`POST /api/organisations/[id]/reopen` clears `isActive` / `closedAt` /
`closedBy` / `closureReason` on both the `Organisation` and `BankAccount` rows
and writes a `RESTORE` audit entry. It refuses a church, an account that is
already open, and an account whose campus is closed — that account would be
unreachable the moment it came back.

The account returns **empty and unheld**. The closing sweep is history, not
something reopening reverses, and the holder's role was deleted at closure, so
someone has to be assigned again before it can be used.

Note the scope check runs against the **campus**, not the account:
`hasOrganisationAccess` walks active descendants only, so asking it about a
closed account always answers no.

## Endpoints

**`GET /api/organisations/[id]/close`** — preflight. Returns `canClose`,
`blockers`, `warnings`, and for accounts also `balance`,
`requiresFundsDisposition`, `pendingTransactionCount`, and
`destinationOptions` (the open operating accounts in the caller's scope). Gated
identically to the close itself, because it discloses who would lose access.

**`POST /api/organisations/[id]/reopen`** — reopens a closed account. No body.
Oversight/HQ role plus scope over the campus.

**`POST /api/organisations/[id]/close`** — closes it.

```jsonc
{
  "reason": "Merged into the main account",
  "disposition": "TRANSFER",          // TRANSFER | WITHDRAW | NONE
  "destinationAccountId": "acct-123"  // TRANSFER only
}
```

Both require an `_ADMIN`/`SUPERADMIN` role *and* scope over the account —
`hasOrganisationAccess` alone is true for a user's own organisation whatever
their role, which would let a holder close the account they hold.

## Audit trail

A closure that moves money writes two entries: a `TRANSFER` entry for the
movement (amount, source, destination, `transferId`) and a `DELETE` entry for the
closure itself, carrying the balance before closing, the disposition, and every
user role removed. Both are `HIGH` severity.
