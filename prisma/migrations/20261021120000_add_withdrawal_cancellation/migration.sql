-- Account holders may cancel a withdrawal request before an admin acts on it.
-- IF NOT EXISTS so a re-run is a no-op.
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CANCEL';

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
