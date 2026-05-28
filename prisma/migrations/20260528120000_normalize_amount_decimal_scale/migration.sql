-- Pin monetary amount columns to scale 2.
-- Changing the column type to numeric(14,2) rounds existing values to two
-- decimal places and stops future writes from storing trailing zeros.
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);
ALTER TABLE "Transaction" ALTER COLUMN "amountInBase" SET DATA TYPE DECIMAL(14,2);
ALTER TABLE "PublicExpenseRequest" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);
