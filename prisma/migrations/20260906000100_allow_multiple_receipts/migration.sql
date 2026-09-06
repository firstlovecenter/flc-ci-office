-- Allow multiple receipt files per transaction
DROP INDEX IF EXISTS "File_transactionId_key";
CREATE INDEX IF NOT EXISTS "File_transactionId_idx" ON "File"("transactionId");
