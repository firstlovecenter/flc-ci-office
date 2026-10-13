-- CreateTable
CREATE TABLE "ExpenseWindowSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openMinutes" INTEGER NOT NULL,
    "closeMinutes" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseWindowSetting_pkey" PRIMARY KEY ("id")
);

-- Seed the window currently in force (6:00 AM – 4:45 PM) so a later change to
-- the code default never moves the live window by itself.
INSERT INTO "ExpenseWindowSetting" ("id", "openMinutes", "closeMinutes", "updatedAt")
VALUES ('default', 360, 1005, CURRENT_TIMESTAMP);
