-- AlterTable
ALTER TABLE "File" ADD COLUMN     "fileSize" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "File_transactionId_key" ON "File"("transactionId");

-- CreateIndex
CREATE INDEX "File_uploadedBy_idx" ON "File"("uploadedBy");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
