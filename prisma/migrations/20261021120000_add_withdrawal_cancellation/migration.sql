-- Account holders may cancel a withdrawal request before an admin acts on it.
-- A cancel is stored as status REJECTED with cancelledAt set, rather than as a
-- new enum value, so code deployed before this migration can still read every
-- row (an unknown enum value makes Prisma throw). Additive and nullable;
-- IF NOT EXISTS so a re-run is a no-op.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
