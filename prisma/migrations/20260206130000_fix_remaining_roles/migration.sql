-- Fix remaining invalid role values - simplified version
-- The main migration already handled most conversions
-- This just cleans up any edge cases

-- Remove any roles from deprecated enums that might still exist
DELETE FROM "UserRole" WHERE "role" IS NULL;
