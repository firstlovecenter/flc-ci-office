-- AlterTable
-- Every campus starts on 6:00 AM – 3:00 PM; each campus admin edits their own.
ALTER TABLE "Organisation" ADD COLUMN     "expenseWindowCloseMinutes" INTEGER NOT NULL DEFAULT 900,
ADD COLUMN     "expenseWindowOpenMinutes" INTEGER NOT NULL DEFAULT 360,
ADD COLUMN     "expenseWindowUpdatedAt" TIMESTAMP(3);
