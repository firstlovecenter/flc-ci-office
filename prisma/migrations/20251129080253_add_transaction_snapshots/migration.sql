-- AlterTable: Add snapshot fields to Transaction table
ALTER TABLE "Transaction" 
ADD COLUMN IF NOT EXISTS "departmentName" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "userName" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "currencyCode" TEXT,
ADD COLUMN IF NOT EXISTS "currencySymbol" TEXT,
ADD COLUMN IF NOT EXISTS "approvedByName" TEXT,
ADD COLUMN IF NOT EXISTS "rejectedByName" TEXT;

-- Backfill department and user names
UPDATE "Transaction" AS t
SET 
  "departmentName" = d.name,
  "userName" = u.name
FROM "Department" d, "User" u
WHERE t."departmentId" = d.id AND t."userId" = u.id;

-- Backfill currency code and symbol
UPDATE "Transaction" AS t
SET 
  "currencyCode" = c.code,
  "currencySymbol" = c.symbol
FROM "Currency" c
WHERE t."currencyId" = c.id;

-- Backfill approvedByName
UPDATE "Transaction" AS t
SET "approvedByName" = u.name
FROM "User" u
WHERE t."approvedBy" = u.id AND t."approvedBy" IS NOT NULL;

-- Backfill rejectedByName
UPDATE "Transaction" AS t
SET "rejectedByName" = u.name
FROM "User" u
WHERE t."rejectedBy" = u.id AND t."rejectedBy" IS NOT NULL;
