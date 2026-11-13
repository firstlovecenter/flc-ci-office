-- Marks a transaction that has already been corrected so a correction can be
-- applied only once (claimed atomically with a conditional update). Additive
-- and nullable; IF NOT EXISTS so a re-run is a no-op.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3);
