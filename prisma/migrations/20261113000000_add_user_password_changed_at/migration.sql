-- Lets a password reset/change end sessions issued before it. Additive and
-- nullable; existing rows are untouched (NULL = never changed since this
-- column existed, so no existing session is invalidated by the migration).
-- IF NOT EXISTS so a re-run is a no-op.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
