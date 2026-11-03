# UI upgrade: patterns from BMS

CI Office and the BMS (FlashSMS) admin portal sit on the same stack — Next.js
App Router, Tailwind v4, Radix/shadcn primitives, lucide icons, Outfit — and
both trace their look back to the FL Admin Portal. BMS went further: its admin
console was reworked around a small set of shared components and conventions
(see `bms.codeslaw/docs/admin-ui-upgrade-plan.md`). This document records
which of those patterns CI Office adopts, what has been built, and the order
for the rest.

**Look:** CI Office keeps its FL palette (pink-red brand on a cool grey
canvas). What carries over is the *shape* of the BMS shell — floating rounded
sidebar, pill navigation with an ink active state, pill filters — and the
interaction patterns, not BMS's orange/warm theme.

## Where CI Office was

| Area | Before | Problem |
| --- | --- | --- |
| Navigation | Items and visibility rules written inline in `ModernDashboardLayout` | A second surface (search) can't reuse it; drift between places |
| Search | Header box and sidebar box both navigate to `/search` | Two inputs, a page load for every lookup, no page jumping |
| Record details | Modal dialog over the list | Hides the list; can't link to a record |
| Statuses | Each page has its own `statusBadgeClass()` | Same status renders differently across pages |
| Queues | Full-width table, newest first, no waiting time | Old requests sink; nothing shows a church is being held up |
| Filters | Component state | Can't link to "declined requests" or open a record from elsewhere |
| States | Mix of pulsing rows, centred text, no retry | Failures look like empty lists |
| Sidebar collapse | Resets on every page load | — |

## Patterns adopted

| Pattern | BMS source | CI Office |
| --- | --- | --- |
| Nav as data, filtered once by permission | `components/admin/nav-config.ts` | `src/lib/nav-config.ts` — sidebar, mobile drawer and ⌘K read it |
| Floating sidebar, pill items, ink active state, remembered collapse | `layout/AdminSidebar.tsx` | `ModernDashboardLayout.tsx` |
| ⌘K palette: pages + live record search | `admin/AdminCommandPalette.tsx` | `components/CommandPalette.tsx` over `/api/search` (no new dependency) |
| Compact list + detail sheet | `admin/record-sheet.tsx` | `components/ui/record-sheet.tsx` (`RecordSheet`, `SheetSection`, `DetailGrid`) |
| Central status → tone map | `admin/status.tsx` | `components/ui/status.tsx` (`TRANSACTION_STATUS`, `TRANSACTION_TYPE`) |
| Toolbar, pill filters with counts, skeleton, error + retry | `admin/list-toolbar.tsx`, `admin/states.tsx` | `components/ui/list-toolbar.tsx` |
| URL-driven state (`?status=`, `?id=`) | `hooks/useUrlState.ts` | `src/hooks/useUrlState.ts` |
| Approval queue: oldest first, waiting time, select-all + bulk with honest partial results, reason required to decline | Held messages / sender-ID queues | `/approvals` |
| Toasts that name the subject and outcome | Every BMS queue action | `/approvals` |

## Deliberately not adopted

- BMS's admin theme (warm canvas, orange signal). CI Office is an FLC product
  and keeps FL's tokens in `globals.css`.
- The AI search hand-off and AI notes in sheets — no AI backend here.
- `cmdk`. The palette is ~200 lines on the Radix dialog already installed.
- SWR / react-hook-form. Worth a separate decision; not needed for the
  patterns above.

## Phases

### Phase 0 — Foundations ✅
`nav-config.ts`, `status.tsx`, `record-sheet.tsx`, `list-toolbar.tsx`,
`useUrlState.ts`.

### Phase 1 — Shell ✅
Floating sidebar driven by nav-config, search button with ⌘K / Ctrl K hint
(and `/`), account menu with theme and log out, remembered collapse, badge
counts as pills. Header reduced to the mobile menu, mobile search and the
role switcher.

### Phase 2 — Approvals (pilot) ✅
Queue with Waiting / Approved / Declined pills and counts, search, oldest
first, waiting-time chip that turns amber after 48 hours, select-all + bulk
approve, details in a sheet (`?id=` deep-links), approve/decline as a short
dialog. Business logic and API calls are unchanged.

### Phase 3 — Remaining queues ✅
- **Toasts** — Sileo with BMS's wrapper (`lib/toast.ts`): one top-centre
  pill, short title, detail on hover. `useToast()` still works for old call
  sites.
- **Badges** — `refreshPendingCounts()` after any change; the shell also
  refetches on window focus.
- **Public requests** — same queue shape; account choice and balance check
  happen in the sheet.
- **Transaction history** — status/type pills in the URL; entry details in a
  sheet. The ledger table stays, since debit/credit/running balance matter.

### Phase 4 — Directories ✅
- **Users** — Active / Archived pills, search by name, email, phone or church;
  sheet with roles and Edit / Full profile / Impersonate.
- **Churches** — level pills, compact rows; sheet with balance (server sum)
  and people; its main button drills into the hierarchy.
- **Accounts** — Open / Closed pills; sheet with balance, holder, and Open
  dashboard / Transfer / Edit, or Reopen for closed accounts.
- **⌘K** — results open the record's sheet (`?id=`); pending withdrawals open
  in the approvals queue.

### Phase 5 — Dashboard ✅
`GET /api/attention`, scoped like the lists it links to: requests waiting
over 48h, newer pending requests, new public requests, overdue receipts (in
scope for managers, your own for leaders), overdrawn accounts. Empty tiles
are hidden; when nothing is due the board says so in one line. Charts are
unchanged.

### Phase 6 — Consistency pass ✅
- Every status renders through `StatusBadge`; no per-page colour helpers left.
- MUI removed: `theme.ts`, `NotificationSettings`, `CorrectTransactionDialog`
  were unreferenced, and `@mui/*` / `@emotion/*` are uninstalled.
- `/search` stays as the “See all results” page behind ⌘K.
- `prisma/seed.js` creates its client with the Prisma 7 adapter.

### Still open
- Many pages still carry `any` types (lint errors predating this work).
- Charts keep their hard-coded hex colours rather than `--chart-*` tokens.
- Verify with production-sized data and every role before release.

## Conventions for new screens

1. Start with `PageHeader` (title, one sentence on what the page is for).
2. Lists are compact rows; a row opens a `RecordSheet`. Dialogs are for
   confirmations and short forms only.
3. Every list has three states: `ListSkeleton`, `EmptyState` (say when items
   will appear), `ErrorState` (with retry).
4. Statuses render through `StatusBadge` with a map from `status.tsx`.
5. Filters that matter, and the open record, live in the URL (`useUrlState`).
6. Toasts name the subject and the outcome; bulk actions report partial
   failures and keep the failures selected.
7. New nav entries go in `nav-config.ts` with their `show` rule — never
   directly into the layout.
