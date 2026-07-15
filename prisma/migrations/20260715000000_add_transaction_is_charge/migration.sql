-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isCharge" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark pre-existing system-generated transaction charges so they're
-- retroactively excluded from receipt enforcement.
UPDATE "Transaction" SET "isCharge" = true WHERE type = 'EXPENSE' AND description LIKE 'Transaction charge for:%';
