-- Migration: Populate UserRole table from existing User data
-- This migrates users from the old roles array to the new UserRole table

DO $$
DECLARE
    user_record RECORD;
    role_value "Role";
    new_user_role_id TEXT;
BEGIN
    RAISE NOTICE 'Starting UserRole migration...';
    
    -- Loop through all users
    FOR user_record IN 
        SELECT id, email, roles, "activeRole", "departmentId"
        FROM "User"
        WHERE archived = false AND "departmentId" IS NOT NULL
    LOOP
        RAISE NOTICE 'Processing user: % (ID: %)', user_record.email, user_record.id;
        
        -- Loop through each role in the user's roles array
        FOREACH role_value IN ARRAY user_record.roles
        LOOP
            -- Insert UserRole if it doesn't exist
            INSERT INTO "UserRole" (id, "userId", role, "departmentId", "createdAt", "updatedAt")
            VALUES (
                gen_random_uuid()::text,
                user_record.id,
                role_value,
                user_record."departmentId",
                NOW(),
                NOW()
            )
            ON CONFLICT ("userId", role, "departmentId") DO NOTHING
            RETURNING id INTO new_user_role_id;
            
            RAISE NOTICE '  Created/Found UserRole: % for department %', role_value, user_record."departmentId";
            
            -- If this is the active role, set it as activeUserRoleId
            IF role_value = user_record."activeRole" AND new_user_role_id IS NOT NULL THEN
                UPDATE "User"
                SET "activeUserRoleId" = new_user_role_id
                WHERE id = user_record.id;
                
                RAISE NOTICE '  Set as active UserRole';
            END IF;
        END LOOP;
        
        -- If activeUserRoleId is still null but user has an active role, try to find it
        IF user_record."activeRole" IS NOT NULL THEN
            UPDATE "User" u
            SET "activeUserRoleId" = (
                SELECT ur.id
                FROM "UserRole" ur
                WHERE ur."userId" = user_record.id
                  AND ur.role = user_record."activeRole"
                  AND ur."departmentId" = user_record."departmentId"
                LIMIT 1
            )
            WHERE u.id = user_record.id
              AND u."activeUserRoleId" IS NULL;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'UserRole migration completed!';
END $$;

-- Show summary
SELECT 
    COUNT(*) as total_user_roles,
    COUNT(DISTINCT "userId") as unique_users
FROM "UserRole";
