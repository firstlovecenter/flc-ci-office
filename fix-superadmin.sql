-- Fix SUPERADMIN users to work with new UserRole system
-- This creates UserRole entries for users who only have the old roles array

-- First, let's get or create a Global department for SUPERADMIN
INSERT INTO "Department" (id, name, level, "parentId", "createdAt", "updatedAt")
VALUES ('global-dept-001', 'Global Administration', 'GLOBAL', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create UserRole for SUPERADMIN user
INSERT INTO "UserRole" (id, "userId", role, "departmentId", "createdAt", "updatedAt")
SELECT 
    'userrole-' || u.id || '-superadmin',
    u.id,
    'SUPERADMIN'::"Role",
    'global-dept-001',
    NOW(),
    NOW()
FROM "User" u
WHERE 'SUPERADMIN' = ANY(u.roles)
AND NOT EXISTS (
    SELECT 1 FROM "UserRole" ur 
    WHERE ur."userId" = u.id 
    AND ur.role = 'SUPERADMIN'
)
ON CONFLICT DO NOTHING;

-- Update users to set their activeUserRoleId
UPDATE "User" u
SET "activeUserRoleId" = (
    SELECT ur.id 
    FROM "UserRole" ur 
    WHERE ur."userId" = u.id 
    AND ur.role = 'SUPERADMIN'
    LIMIT 1
),
"departmentId" = 'global-dept-001'
WHERE 'SUPERADMIN' = ANY(u.roles)
AND u."activeUserRoleId" IS NULL;

-- Verify the changes
SELECT 
    u.email,
    u.roles,
    u."departmentId",
    d.name as "departmentName",
    u."activeUserRoleId",
    ur.role as "activeRole"
FROM "User" u
LEFT JOIN "Department" d ON u."departmentId" = d.id
LEFT JOIN "UserRole" ur ON u."activeUserRoleId" = ur.id
WHERE u.email = 'skaduteye@gmail.com';
