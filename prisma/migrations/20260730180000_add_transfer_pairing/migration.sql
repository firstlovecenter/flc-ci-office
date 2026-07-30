-- Pairs the two legs of an account-to-account transfer.
-- Purely additive: new enum, two nullable columns, one index. No data is read
-- or rewritten, so this is safe to apply to a live database.

CREATE TYPE "TransferDirection" AS ENUM ('OUT', 'IN');

ALTER TABLE "Transaction" ADD COLUMN "transferId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "transferDirection" "TransferDirection";

CREATE INDEX "Transaction_transferId_idx" ON "Transaction"("transferId");
