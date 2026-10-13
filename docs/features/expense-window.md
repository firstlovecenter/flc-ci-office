# Withdrawal submission window

Leaders and the public expense-request form may only submit withdrawal requests
inside a daily window, Monday to Saturday, Ghana time (UTC). Sundays are always
closed. Special-project accounts are exempt and may submit at any hour.

## Changing the times

HQ (`SUPERADMIN` and `DENOMINATION_ADMIN`) edit the opening and closing times
under **Settings** in the sidebar. The change applies to the next request — no
deploy. A request at the closing time itself is refused (the window is
`open ≤ now < close`), and the window never spans midnight.

Every change is audit-logged (`UPDATE` on `ExpenseWindowSetting`, severity HIGH)
with the old and new times.

## Where the times live

- `ExpenseWindowSetting` — one row, `id = 'default'`, times as minutes after
  midnight. The migration seeds it with the window in force when it shipped
  (6:00 AM – 4:45 PM).
- `lib/expense-window.ts` — pure functions. Every check and every label takes
  the config as an argument, so the server check, the client gates and the copy
  cannot disagree. `DEFAULT_EXPENSE_WINDOW` is the fallback.
- `lib/expense-window-settings.ts` — `getExpenseWindowConfig()` reads the row on
  every call. If the row is missing, invalid, or the table does not exist yet,
  it falls back to the default rather than blocking submissions.
- `hooks/useExpenseWindow.ts` — one shared client fetch for the sidebar,
  dashboard, forms and public page. Saving from Settings updates every mounted
  consumer.

## Endpoints

| Method | Path | Who | |
| :-- | :-- | :-- | :-- |
| GET | `/api/expense-window` | Anyone (public) | The window in force. The unauthenticated request form needs it. |
| PUT | `/api/admin/expense-window` | HQ only | `{ openMinutes, closeMinutes }`. 400 if invalid, 403 for other roles. |

The window is enforced server-side in `POST /api/transactions` (leaders) and
`POST /api/public-expense`. The client checks are presentation only.

## Deploying

Apply the migration (`npx prisma migrate deploy`). Until it is applied the app
keeps enforcing the default window and saving from Settings returns an error.
