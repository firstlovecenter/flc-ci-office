-- Refactor roles and departments: rename + remove scopes
-- Remove: INTERNATIONAL_*, NATIONAL_* 
-- Rename: GLOBAL_* -> DENOMINATION_*, REGIONAL_* -> OVERSIGHT_*

-- First, temporarily convert User.activeRole to text to allow value transformation
ALTER TABLE "User" ALTER COLUMN "activeRole" TYPE text;

-- Update User activeRole values
UPDATE "User" SET "activeRole" = 'DENOMINATION_ADMIN' WHERE "activeRole" = 'GLOBAL_ADMIN';
UPDATE "User" SET "activeRole" = 'DENOMINATION_LEADER' WHERE "activeRole" = 'GLOBAL_LEADER';
UPDATE "User" SET "activeRole" = 'OVERSIGHT_ADMIN' WHERE "activeRole" = 'REGIONAL_ADMIN';
UPDATE "User" SET "activeRole" = 'OVERSIGHT_LEADER' WHERE "activeRole" = 'REGIONAL_LEADER';

-- Similarly handle UserRole.role
ALTER TABLE "UserRole" ALTER COLUMN "role" TYPE text;

-- Update UserRole role values
UPDATE "UserRole" SET "role" = 'DENOMINATION_ADMIN' WHERE "role" = 'GLOBAL_ADMIN';
UPDATE "UserRole" SET "role" = 'DENOMINATION_LEADER' WHERE "role" = 'GLOBAL_LEADER';
UPDATE "UserRole" SET "role" = 'OVERSIGHT_ADMIN' WHERE "role" = 'REGIONAL_ADMIN';
UPDATE "UserRole" SET "role" = 'OVERSIGHT_LEADER' WHERE "role" = 'REGIONAL_LEADER';

-- Remove any deprecated role entries (should not exist, but just in case)
DELETE FROM "UserRole" WHERE "role" IN ('INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER', 'NATIONAL_ADMIN', 'NATIONAL_LEADER');

-- Create new Role enum type with updated values
CREATE TYPE "Role" AS ENUM (
    'SUPERADMIN',
    'DENOMINATION_ADMIN',
    'DENOMINATION_LEADER',
    'OVERSIGHT_ADMIN',
    'OVERSIGHT_LEADER',
    'CAMPUS_ADMIN',
    'CAMPUS_LEADER',
    'STREAM_ADMIN',
    'STREAM_LEADER',
    'COUNCIL_ADMIN',
    'COUNCIL_LEADER'
);

-- Convert User.activeRole back to the new enum type
ALTER TABLE "User" ALTER COLUMN "activeRole" TYPE "Role" USING "activeRole"::Role;

-- Convert UserRole.role back to the new enum type
ALTER TABLE "UserRole" ALTER COLUMN "role" TYPE "Role" USING "role"::Role;

-- Update Department.level values
ALTER TABLE "Department" ALTER COLUMN "level" TYPE text;

-- Update Department level values
UPDATE "Department" SET "level" = 'DENOMINATION' WHERE "level" = 'GLOBAL';
UPDATE "Department" SET "level" = 'OVERSIGHT' WHERE "level" = 'REGIONAL';

-- Remove departments with deprecated levels (if any)
DELETE FROM "Department" WHERE "level" IN ('INTERNATIONAL', 'NATIONAL');

-- Create new DepartmentLevel enum type with updated values
CREATE TYPE "DepartmentLevel" AS ENUM (
    'DENOMINATION',
    'OVERSIGHT',
    'CAMPUS',
    'STREAM',
    'COUNCIL'
);

-- Convert Department.level back to the new enum type
ALTER TABLE "Department" ALTER COLUMN "level" TYPE "DepartmentLevel" USING "level"::"DepartmentLevel";

-- Drop old enum types if they still exist
DROP TYPE IF EXISTS "Role_old" CASCADE;
DROP TYPE IF EXISTS "DepartmentLevel_old" CASCADE;



-- Drop old enum types
DROP TYPE "Role";
DROP TYPE "DepartmentLevel";

-- Rename new enum types
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TYPE "DepartmentLevel_new" RENAME TO "DepartmentLevel";
