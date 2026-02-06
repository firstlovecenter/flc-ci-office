-- Refactor roles and departments: rename + remove scopes
-- This migration handles the transition from old role/department names to new ones

-- Delete base currencies first (foreign key constraint)
DELETE FROM "DepartmentBaseCurrency" 
WHERE "departmentId" IN (
  SELECT id FROM "Department" 
  WHERE "level" IN ('INTERNATIONAL', 'NATIONAL') OR "level" IS NULL
);

-- Convert User.activeRole to text for manipulation
ALTER TABLE "User" ALTER COLUMN "activeRole" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "activeRole" TYPE text;

-- Update all User activeRole values
UPDATE "User" SET "activeRole" = 'DENOMINATION_ADMIN' WHERE "activeRole" = 'GLOBAL_ADMIN';
UPDATE "User" SET "activeRole" = 'DENOMINATION_LEADER' WHERE "activeRole" = 'GLOBAL_LEADER';
UPDATE "User" SET "activeRole" = 'OVERSIGHT_ADMIN' WHERE "activeRole" = 'REGIONAL_ADMIN';
UPDATE "User" SET "activeRole" = 'OVERSIGHT_LEADER' WHERE "activeRole" = 'REGIONAL_LEADER';
UPDATE "User" SET "activeRole" = NULL WHERE "activeRole" IN ('INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER', 'NATIONAL_ADMIN', 'NATIONAL_LEADER');

-- Convert UserRole.role to text for manipulation
ALTER TABLE "UserRole" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "UserRole" ALTER COLUMN "role" TYPE text;

-- Update all UserRole role values
UPDATE "UserRole" SET "role" = 'DENOMINATION_ADMIN' WHERE "role" = 'GLOBAL_ADMIN';
UPDATE "UserRole" SET "role" = 'DENOMINATION_LEADER' WHERE "role" = 'GLOBAL_LEADER';
UPDATE "UserRole" SET "role" = 'OVERSIGHT_ADMIN' WHERE "role" = 'REGIONAL_ADMIN';
UPDATE "UserRole" SET "role" = 'OVERSIGHT_LEADER' WHERE "role" = 'REGIONAL_LEADER';

-- Delete old roles from UserRole
DELETE FROM "UserRole" WHERE "role" IN ('INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER', 'NATIONAL_ADMIN', 'NATIONAL_LEADER');

-- Convert Department.level to text for manipulation
ALTER TABLE "Department" ALTER COLUMN "level" DROP NOT NULL;
ALTER TABLE "Department" ALTER COLUMN "level" TYPE text;

-- Update all Department level values
UPDATE "Department" SET "level" = 'DENOMINATION' WHERE "level" = 'GLOBAL';
UPDATE "Department" SET "level" = 'OVERSIGHT' WHERE "level" = 'REGIONAL';

-- Delete old departments
DELETE FROM "Department" WHERE "level" IN ('INTERNATIONAL', 'NATIONAL');

-- Drop old enum types
DROP TYPE IF EXISTS "Role" CASCADE;
DROP TYPE IF EXISTS "DepartmentLevel" CASCADE;

-- Create new Role enum
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

-- Create new DepartmentLevel enum
CREATE TYPE "DepartmentLevel" AS ENUM (
  'DENOMINATION',
  'OVERSIGHT',
  'CAMPUS',
  'STREAM',
  'COUNCIL'
);

-- Convert back to new enums
ALTER TABLE "User" ALTER COLUMN "activeRole" TYPE "Role" USING "activeRole"::text::"Role";
ALTER TABLE "UserRole" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "Department" ALTER COLUMN "level" TYPE "DepartmentLevel" USING "level"::text::"DepartmentLevel";
