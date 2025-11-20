-- Fix transactions with incorrect amountInBase
-- This script updates amountInBase for all transactions

-- First, update transactions where amountInBase is null
-- For base currency transactions (no currencyId or exchangeRate), set amountInBase = amount
UPDATE "Transaction"
SET "amountInBase" = amount
WHERE "amountInBase" IS NULL 
  AND ("currencyId" IS NULL OR "exchangeRate" IS NULL);

-- For transactions with currency and exchange rate, calculate properly
UPDATE "Transaction"
SET "amountInBase" = amount * "exchangeRate"
WHERE "amountInBase" IS NULL 
  AND "currencyId" IS NOT NULL 
  AND "exchangeRate" IS NOT NULL;

-- Also fix any existing transactions where amountInBase doesn't match calculation
UPDATE "Transaction"
SET "amountInBase" = amount * "exchangeRate"
WHERE "currencyId" IS NOT NULL 
  AND "exchangeRate" IS NOT NULL
  AND "amountInBase" != amount * "exchangeRate";

-- For base currency transactions, ensure amountInBase equals amount
UPDATE "Transaction"
SET "amountInBase" = amount
WHERE ("currencyId" IS NULL OR "exchangeRate" IS NULL)
  AND "amountInBase" != amount;

-- Verify the fixes
SELECT 
    id,
    type,
    amount,
    "currencyId",
    "exchangeRate",
    "amountInBase",
    CASE 
        WHEN "currencyId" IS NULL OR "exchangeRate" IS NULL THEN amount
        ELSE amount * "exchangeRate"
    END as calculated_base
FROM "Transaction"
WHERE "amountInBase" IS NULL
   OR "amountInBase" != CASE 
        WHEN "currencyId" IS NULL OR "exchangeRate" IS NULL THEN amount
        ELSE amount * "exchangeRate"
    END
LIMIT 10;
