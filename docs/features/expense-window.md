# Withdrawal submission window

Leaders and the public expense-request form may only submit withdrawal requests
inside a daily window, Monday to Saturday, Ghana time (UTC). Sundays are always
closed. Special-project accounts are exempt and may submit at any hour.

**Each campus has its own window.** Accounts use the window of the campus they
sit under; a public request uses the window of the campus chosen on the form.

## Changing the times

A campus admin edits their own campus's opening and closing times under
**Settings** in the sidebar. The campus is always the admin's active role's
campus — never taken from the request — so one campus cannot change another's.

A **super admin** sees every active campus on the same page and picks which one
to change. No other role can edit a window.
The change applies to the next request, no deploy. A request at the closing
time itself is refused (the window is `open ≤ now < close`), and the window
never spans midnight.

Every campus starts on **6:00 AM – 3:00 PM**.

Every change is audit-logged (`UPDATE` on the campus `Organisation`, severity
HIGH, metadata `setting: expense-window` and the editor's role) with the old
and new times.

## Where the times live

- `Organisation.expenseWindowOpenMinutes` / `expenseWindowCloseMinutes` —
  minutes after midnight, defaulting to 360 / 900. Only read on CAMPUS rows.
  `expenseWindowUpdatedAt` records the last edit.
- `lib/expense-window.ts` — pure functions. Every check and every label takes
  the config as an argument, so the server check, the client gates and the copy
  cannot disagree. `DEFAULT_EXPENSE_WINDOW` (6:00 AM – 3:00 PM) must match the
  column defaults.
- `lib/expense-window-settings.ts` — `getExpenseWindowForOrganisation(id)` walks
  up from an account to its campus and reads that campus's window on every call.
  With no campus above it, an unreadable row or an invalid stored window it
  falls back to the default rather than blocking submissions.
- `hooks/useExpenseWindow.ts` — a shared client cache keyed by organisation for
  the sidebar, dashboard, forms and new-request page. Saving from Settings
  clears it.

## Endpoints

| Method | Path | Who | |
| :-- | :-- | :-- | :-- |
| GET | `/api/expense-window?organisationId=` | Signed in | The window for a campus or account. |
| GET | `/api/admin/expense-window` | Campus admins, super admins | `{ canChooseCampus, campuses }` — a campus admin's own campus, or every active campus for a super admin. |
| PUT | `/api/admin/expense-window` | Campus admins, super admins | `{ openMinutes, closeMinutes }`, plus `campusId` from a super admin. A campus admin always saves to their own campus. 400 if invalid, 403 for other roles. |
| GET | `/api/public-expense/campuses` | Public | Now includes each campus's `openMinutes` / `closeMinutes`. |

The window is enforced server-side in `POST /api/transactions` (leaders, by the
account's campus) and `POST /api/public-expense` (by the chosen campus). The
client checks are presentation only.

## Deploying

Production builds apply pending migrations themselves: `npm run build` runs
`scripts/migrate-on-deploy.mjs` (`prisma migrate deploy`) before `next build`
when `VERCEL_ENV=production`. Preview and local builds skip it. A failed
migration fails the build, so the previous deployment stays live.

The migration uses `ADD COLUMN IF NOT EXISTS`, so re-running it never touches
existing values. It gives every campus 6:00 AM – 3:00 PM, which moves the close
from the 4:45 PM in force before.
