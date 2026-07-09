-- AlterTable
-- Preserves the originally requested amount when an approver changes the
-- amount during approval, so the requested value is never silently lost.
ALTER TABLE "Transaction" ADD COLUMN "requestedAmount" DECIMAL(14,2);
