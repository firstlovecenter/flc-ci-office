-- Rename REJECTED to DECLINED in TransactionStatus enum
-- First, add the new value if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DECLINED' AND enumtypid = 'TransactionStatus'::regtype) THEN
        ALTER TYPE "TransactionStatus" ADD VALUE 'DECLINED';
    END IF;
END$$;

-- Update all existing REJECTED values to DECLINED
UPDATE "Transaction" SET status = 'DECLINED' WHERE status = 'REJECTED';

-- Note: PostgreSQL doesn't support removing enum values directly
-- The REJECTED value will remain in the enum definition but won't be used
