-- Makes "create transaction" safe to retry (double tap, flaky network): a
-- repeated request carrying the same key returns the original row instead of
-- creating a second one. The unique index is what makes it race-safe.
-- Additive and nullable (existing rows keep NULL, which never collides).
-- IF NOT EXISTS so a re-run is a no-op.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");
