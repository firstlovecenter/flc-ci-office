-- Rename Department → Organisation (table, columns, enums, FKs)
-- Also introduces AccountType for Account (COUNCIL) rows.

-- 1) Enums
ALTER TYPE "DepartmentLevel" RENAME TO "OrganisationLevel";

CREATE TYPE "AccountType" AS ENUM ('OPERATING', 'SPECIAL_PROJECT');

-- 2) Core table rename
ALTER TABLE "Department" RENAME TO "Organisation";

ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "accountType" "AccountType";

UPDATE "Organisation"
SET "accountType" = 'OPERATING'
WHERE "level" = 'COUNCIL' AND "accountType" IS NULL;

-- 3) DepartmentBaseCurrency → OrganisationBaseCurrency
ALTER TABLE "DepartmentBaseCurrency" RENAME TO "OrganisationBaseCurrency";
ALTER TABLE "OrganisationBaseCurrency" RENAME COLUMN "departmentId" TO "organisationId";

-- 4) FK columns on related tables
ALTER TABLE "Transaction" RENAME COLUMN "departmentId" TO "organisationId";
ALTER TABLE "User" RENAME COLUMN "departmentId" TO "organisationId";
ALTER TABLE "UserRole" RENAME COLUMN "departmentId" TO "organisationId";
ALTER TABLE "PublicExpenseRequest" RENAME COLUMN "oversightDeptId" TO "oversightOrganisationId";

-- 5) Indexes renamed for clarity (Postgres keeps old names after column rename)
ALTER INDEX IF EXISTS "Department_isActive_idx" RENAME TO "Organisation_isActive_idx";
ALTER INDEX IF EXISTS "Department_level_idx" RENAME TO "Organisation_level_idx";
ALTER INDEX IF EXISTS "Department_parentId_idx" RENAME TO "Organisation_parentId_idx";

ALTER INDEX IF EXISTS "DepartmentBaseCurrency_currencyId_idx" RENAME TO "OrganisationBaseCurrency_currencyId_idx";
ALTER INDEX IF EXISTS "DepartmentBaseCurrency_departmentId_key" RENAME TO "OrganisationBaseCurrency_organisationId_key";
ALTER INDEX IF EXISTS "DepartmentBaseCurrency_departmentId_idx" RENAME TO "OrganisationBaseCurrency_organisationId_idx";

ALTER INDEX IF EXISTS "Transaction_departmentId_idx" RENAME TO "Transaction_organisationId_idx";
ALTER INDEX IF EXISTS "Transaction_departmentId_status_type_idx" RENAME TO "Transaction_organisationId_status_type_idx";

ALTER INDEX IF EXISTS "UserRole_departmentId_idx" RENAME TO "UserRole_organisationId_idx";
ALTER INDEX IF EXISTS "UserRole_userId_role_departmentId_key" RENAME TO "UserRole_userId_role_organisationId_key";

ALTER INDEX IF EXISTS "PublicExpenseRequest_oversightDeptId_idx" RENAME TO "PublicExpenseRequest_oversightOrganisationId_idx";

CREATE INDEX IF NOT EXISTS "Organisation_accountType_idx" ON "Organisation"("accountType");
