-- Link public expense requests to campuses instead of oversights.
-- 1) Add campusOrganisationId
-- 2) Backfill from oversight → campus children
-- 3) Drop oversight column / FK / index

ALTER TABLE "PublicExpenseRequest" ADD COLUMN "campusOrganisationId" TEXT;

-- Outside Accra oversight → its single Outside Accra campus
UPDATE "PublicExpenseRequest" AS per
SET "campusOrganisationId" = campus.id
FROM "Organisation" AS o
JOIN "Organisation" AS campus
  ON campus."parentId" = o.id
 AND campus.level = 'CAMPUS'
 AND campus."isActive" = true
WHERE per."oversightOrganisationId" = o.id
  AND o.level = 'OVERSIGHT'
  AND o.name = 'Outside Accra';

-- Accra oversight (multiple campuses): prefer first active campus by name for history
UPDATE "PublicExpenseRequest" AS per
SET "campusOrganisationId" = (
  SELECT campus.id
  FROM "Organisation" AS campus
  WHERE campus."parentId" = per."oversightOrganisationId"
    AND campus.level = 'CAMPUS'
    AND campus."isActive" = true
  ORDER BY campus.name ASC
  LIMIT 1
)
WHERE per."campusOrganisationId" IS NULL;

-- Any remaining rows: pick any active campus under the oversight, else any active campus
UPDATE "PublicExpenseRequest" AS per
SET "campusOrganisationId" = (
  SELECT campus.id
  FROM "Organisation" AS campus
  WHERE campus.level = 'CAMPUS'
    AND campus."isActive" = true
  ORDER BY campus.name ASC
  LIMIT 1
)
WHERE per."campusOrganisationId" IS NULL;

ALTER TABLE "PublicExpenseRequest" ALTER COLUMN "campusOrganisationId" SET NOT NULL;

ALTER TABLE "PublicExpenseRequest" DROP CONSTRAINT IF EXISTS "PublicExpenseRequest_oversightOrganisationId_fkey";
DROP INDEX IF EXISTS "PublicExpenseRequest_oversightOrganisationId_idx";
ALTER TABLE "PublicExpenseRequest" DROP COLUMN "oversightOrganisationId";

CREATE INDEX "PublicExpenseRequest_campusOrganisationId_idx" ON "PublicExpenseRequest"("campusOrganisationId");

ALTER TABLE "PublicExpenseRequest"
  ADD CONSTRAINT "PublicExpenseRequest_campusOrganisationId_fkey"
  FOREIGN KEY ("campusOrganisationId") REFERENCES "Organisation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
