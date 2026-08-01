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

## Endpoints

**`GET /api/organisations/[id]/close`** — preflight. Returns `canClose`,
`blockers`, `warnings`, and for accounts also `balance`,
`requiresFundsDisposition`, `pendingTransactionCount`, and
`destinationOptions` (the open operating accounts in the caller's scope). Gated
identically to the close itself, because it discloses who would lose access.

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
