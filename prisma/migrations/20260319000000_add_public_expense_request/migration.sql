-- CreateEnum
CREATE TYPE "PublicExpenseRequestStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED');

-- CreateTable
CREATE TABLE "PublicExpenseRequest" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "churchName" TEXT NOT NULL,
    "momoName" TEXT NOT NULL,
    "momoNumber" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PublicExpenseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "oversightDeptId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicExpenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicExpenseRequest_transactionId_key" ON "PublicExpenseRequest"("transactionId");

-- CreateIndex
CREATE INDEX "PublicExpenseRequest_oversightDeptId_idx" ON "PublicExpenseRequest"("oversightDeptId");

-- CreateIndex
CREATE INDEX "PublicExpenseRequest_status_idx" ON "PublicExpenseRequest"("status");

-- AddForeignKey
ALTER TABLE "PublicExpenseRequest" ADD CONSTRAINT "PublicExpenseRequest_oversightDeptId_fkey" FOREIGN KEY ("oversightDeptId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicExpenseRequest" ADD CONSTRAINT "PublicExpenseRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
