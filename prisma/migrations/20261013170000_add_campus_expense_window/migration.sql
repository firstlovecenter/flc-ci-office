-- AlterTable
-- Every campus starts on 6:00 AM – 3:00 PM; each campus admin edits their own.
-- IF NOT EXISTS so a re-run (or a column added by hand) is a no-op and existing
-- values are never touched.
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "expenseWindowCloseMinutes" INTEGER NOT NULL DEFAULT 900,
ADD COLUMN IF NOT EXISTS "expenseWindowOpenMinutes" INTEGER NOT NULL DEFAULT 360,
ADD COLUMN IF NOT EXISTS "expenseWindowUpdatedAt" TIMESTAMP(3);
