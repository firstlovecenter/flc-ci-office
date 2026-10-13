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
The change applies to the next request, no deploy. A request at the closing
time itself is refused (the window is `open ≤ now < close`), and the window
never spans midnight.

Every campus starts on **6:00 AM – 3:00 PM**.

Every change is audit-logged (`UPDATE` on the campus `Organisation`, severity
HIGH, metadata `setting: expense-window`) with the old and new times.

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
| GET | `/api/admin/expense-window` | Campus admins | Their own campus's window. |
| PUT | `/api/admin/expense-window` | Campus admins | `{ openMinutes, closeMinutes }` for their own campus. 400 if invalid, 403 otherwise. |
| GET | `/api/public-expense/campuses` | Public | Now includes each campus's `openMinutes` / `closeMinutes`. |

The window is enforced server-side in `POST /api/transactions` (leaders, by the
account's campus) and `POST /api/public-expense` (by the chosen campus). The
client checks are presentation only.

## Deploying

Apply the migration (`npx prisma migrate deploy`). It adds the columns with the
6:00 AM – 3:00 PM default to every campus — this moves the close from the
4:45 PM that was in force before. Until it is applied the app keeps enforcing
the 6:00 AM – 3:00 PM default and saving from Settings returns an error.
