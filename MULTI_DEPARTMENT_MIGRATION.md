# Multi-Department Role Support Migration

## Overview
Updated the system to support users having multiple role-department combinations. For example, a user can now be a CAMPUS_ADMIN for two different campuses, and these are treated as separate roles.

## Database Changes

### New Model: UserRole
```prisma
model UserRole {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         Role
  departmentId String
  department   Department  @relation(fields: [departmentId], references: [id])
  activeUsers  User[]      @relation("ActiveUserRole")
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@unique([userId, role, departmentId])
  @@index([userId])
  @@index([departmentId])
  @@index([role])
}
```

### Updated User Model
Added new fields:
- `userRoles: UserRole[]` - Array of role-department assignments
- `activeUserRoleId: String?` - ID of the currently active role-department combo
- `activeUserRole: UserRole?` - Relation to the active UserRole

Deprecated (kept for backward compatibility):
- `roles: Role[]` - Old roles array
- `activeRole: Role?` - Old active role
- `departmentId: String?` - Old single department assignment

## Migration Process

### Step 1: Schema Update ✅
Schema has been updated and pushed to the database using `npx prisma db push`

### Step 2: Data Migration
Run the SQL migration script to populate UserRole from existing user data:

```bash
# Connect to your database and run:
psql <your-database-url> < scripts/migrate-user-roles.sql
```

Or run via the app (create an API route if needed).

### Step 3: Update Application Code
The following files need to be updated to use UserRole instead of the old roles array:

1. **Authentication (src/lib/auth.ts)**
   - Update JWT callback to include userRoles
   - Update session to use activeUserRole

2. **Role Switching (src/components/RoleSwitcher.tsx)**
   - Display role-department combinations
   - Switch between UserRole entries

3. **Role Selection (src/app/select-role/page.tsx)**
   - Show list of UserRole combinations
   - Set activeUserRoleId instead of activeRole

4. **API Routes**
   - Update permission checks to use userRoles
   - Update currency logic to use activeUserRole.department

5. **Dashboard (src/app/dashboard/page.tsx)**
   - Already updated to show department name ✅

## Example: Adding Multiple Departments to a User

```typescript
// Old way (single department):
await prisma.user.update({
  where: { id: userId },
  data: {
    roles: ['CAMPUS_ADMIN'],
    departmentId: campusId,
  },
});

// New way (multiple departments):
await prisma.userRole.createMany({
  data: [
    { userId, role: 'CAMPUS_ADMIN', departmentId: campus1Id },
    { userId, role: 'CAMPUS_ADMIN', departmentId: campus2Id },
  ],
});

// Set one as active:
const activeUserRole = await prisma.userRole.findFirst({
  where: { userId, departmentId: campus1Id },
});
await prisma.user.update({
  where: { id: userId },
  data: { activeUserRoleId: activeUserRole.id },
});
```

## Testing Checklist

- [ ] Run SQL migration script
- [ ] Verify UserRole table is populated correctly
- [ ] Update auth.ts to use userRoles
- [ ] Update RoleSwitcher component
- [ ] Update select-role page
- [ ] Test role switching between different departments
- [ ] Test permissions with multiple role-department combos
- [ ] Test currency assignment for different departments
- [ ] Update user management to create UserRole entries
- [ ] After thorough testing, remove deprecated fields

## Benefits

1. **Flexibility**: Users can have the same role in multiple departments
2. **Clarity**: Each role-department combination is explicit
3. **Scalability**: Easy to add/remove role assignments
4. **Audit Trail**: Timestamps on each role assignment
5. **Referential Integrity**: Proper foreign keys and cascading deletes

## Next Steps

1. Run the SQL migration to populate UserRole table
2. Update application code to use new UserRole model
3. Test thoroughly
4. Remove deprecated fields after confidence is established
