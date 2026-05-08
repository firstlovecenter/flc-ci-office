---
name: Show exact transaction amounts, never rounded
description: All monetary figures shown in the UI must be the true, exact stored value — what the user sees must equal what is spendable/validatable
type: feedback
---

The app must always display exact transaction amounts in the UI — never rounded, truncated, or formatted-to-2dp values that diverge from the underlying stored figure. Whatever balance, amount, or total a user sees on screen must be the real figure that the system uses for validation (e.g. expense balance checks) and that the user can act on (e.g. fully expend).

**Why:** A user hit a case where the displayed balance looked like the full balance, but the validator blocked spending the full amount because the stored value was actually slightly less due to float-precision drift in summed Decimals. Hiding precision behind `formatNumber`/`toFixed(2)` while validating against the raw float caused a UI/server mismatch — user saw ₵1,000, system had ₵999.9999999998, request rejected. The user's preference is that this class of bug should be impossible: display = truth.

**How to apply:**
- Don't use `Math.round(x * 100) / 100`, `toFixed(2)`, or epsilon-based comparisons as a fix for precision drift. Those make the UI look right but leave the underlying value wrong.
- Fix precision at the source: keep monetary values as `Prisma.Decimal` end-to-end and avoid coercing to JS `number` for sums or comparisons.
- When formatting for display, format the *exact* stored value — if a balance is 999.9998, show 999.9998 (or whatever stored precision is), not 1,000.00.
- Validators (e.g. balance checks in `src/app/api/transactions/route.ts`) and display endpoints (e.g. `src/app/api/departments/[id]/stats/route.ts`) must agree on the same exact number — same source, same arithmetic, no rounding gap between them.
- If a feature seems to need rounding to "make the numbers match," the root cause is upstream — fix the arithmetic, not the display.
