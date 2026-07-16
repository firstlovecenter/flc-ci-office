-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'RECEIPT_WAIVED';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "receiptWaived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptWaivedAt" TIMESTAMP(3),
ADD COLUMN     "receiptWaivedBy" TEXT,
ADD COLUMN     "receiptWaivedReason" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receiptWaivedBy_fkey" FOREIGN KEY ("receiptWaivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
