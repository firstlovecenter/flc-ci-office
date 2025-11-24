-- Add placeholder phone numbers to users without phones
UPDATE "User" 
SET phone = CONCAT('233000', SUBSTRING(id FROM 1 FOR 6))
WHERE phone IS NULL;

-- Verify the update
SELECT id, name, email, phone 
FROM "User" 
WHERE phone LIKE '233000%';
