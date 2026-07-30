-- Bank-account split, EXPAND phase.
--
-- Creates the BankAccount table and back-fills it from the legacy Organisation
-- rows with level = 'COUNCIL', preserving ids so dependent foreign keys can be
-- re-pointed by copying the value rather than remapping.
--
-- Additive only. The COUNCIL rows stay exactly where they are and the
-- application keeps reading them, so this changes no behaviour. The scope
-- baseline must still verify clean after it runs.

CREATE TABLE "BankAccount" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "campusId"      TEXT NOT NULL,
    "accountType"   "AccountType" NOT NULL DEFAULT 'OPERATING',
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "closedAt"      TIMESTAMP(3),
    "closedBy"      TEXT,
    "closureReason" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankAccount_campusId_idx"    ON "BankAccount"("campusId");
CREATE INDEX "BankAccount_isActive_idx"    ON "BankAccount"("isActive");
CREATE INDEX "BankAccount_accountType_idx" ON "BankAccount"("accountType");

ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_campusId_fkey"
    FOREIGN KEY ("campusId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Copy every COUNCIL row across, ids intact.
INSERT INTO "BankAccount" ("id","name","campusId","accountType","isActive","closedAt","closedBy","closureReason","createdAt","updatedAt")
SELECT o.id, o.name, o."parentId", COALESCE(o."accountType", 'OPERATING'), o."isActive",
       o."closedAt", o."closedBy", o."closureReason", o."createdAt", o."updatedAt"
FROM "Organisation" o
WHERE o.level = 'COUNCIL' AND o."parentId" IS NOT NULL;

-- Nullable mirrors on the three dependent tables.
ALTER TABLE "Transaction" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "UserRole"    ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "User"        ADD COLUMN "bankAccountId" TEXT;

CREATE INDEX "Transaction_bankAccountId_idx" ON "Transaction"("bankAccountId");
CREATE INDEX "UserRole_bankAccountId_idx"    ON "UserRole"("bankAccountId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Back-fill the mirrors. Because ids were preserved this is a straight copy.
UPDATE "Transaction" t SET "bankAccountId" = t."organisationId"
    FROM "BankAccount" b WHERE b.id = t."organisationId";
UPDATE "UserRole" r SET "bankAccountId" = r."organisationId"
    FROM "BankAccount" b WHERE b.id = r."organisationId";
UPDATE "User" u SET "bankAccountId" = u."organisationId"
    FROM "BankAccount" b WHERE b.id = u."organisationId";
