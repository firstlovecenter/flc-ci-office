# Multiple Admins Per Department

## Overview
Multiple users can now be assigned the same admin role for the same department, with two exceptions:
- **SUPERADMIN**: Only one can exist globally
- **GLOBAL_ADMIN**: Only one can exist globally

This allows for flexible team management where multiple campus admins can manage the same campus, multiple regional admins can manage the same region, etc.

## Role Assignment Rules

### Unique Roles (System-Wide)
These roles can only be assigned to **one person** in the entire system:

1. **SUPERADMIN**
   - Full system access
   - Can only be assigned to one user
   - Has access to all features and departments

2. **GLOBAL_ADMIN**
   - Manages global-level finances and operations
   - Can only be assigned to one user
   - Second-highest privilege level

### Shared Roles (Multiple Users Allowed)
All other roles can be assigned to **multiple users** for the same department:

- **GLOBAL_LEADER** - Multiple allowed
- **INTERNATIONAL_ADMIN** - Multiple allowed
- **INTERNATIONAL_LEADER** - Multiple allowed
- **NATIONAL_ADMIN** - Multiple allowed
- **NATIONAL_LEADER** - Multiple allowed
- **REGIONAL_ADMIN** - Multiple allowed
- **REGIONAL_LEADER** - Multiple allowed
- **CAMPUS_ADMIN** - Multiple allowed
- **CAMPUS_LEADER** - Multiple allowed
- **STREAM_LEADER** - Multiple allowed
- **COUNCIL_LEADER** - Multiple allowed

### Example Scenarios

**Scenario 1: Multiple Campus Admins**
```
Campus: UCC Revival Campus
Campus Admins:
  - John Doe (CAMPUS_ADMIN)
  - Jane Smith (CAMPUS_ADMIN)
  - Bob Johnson (CAMPUS_ADMIN)
```
All three users can:
- Approve transactions for the campus
- Manage users in the campus
- View campus reports
- Set campus base currency

**Scenario 2: Shared Regional Management**
```
Region: Greater Accra
Regional Admins:
  - Alice Brown (REGIONAL_ADMIN)
  - Charlie Wilson (REGIONAL_ADMIN)
```
Both users can manage all campuses under Greater Accra region.

## Implementation Details

### Role Validation (`src/lib/roleValidation.ts`)

The `validateRoleAssignment()` function checks:

```typescript
// Check for SUPERADMIN constraint
if (roles.includes('SUPERADMIN')) {
    const existingSuperAdmin = await prisma.user.findFirst({
        where: {
            roles: { has: 'SUPERADMIN' },
            id: { not: userId },
            archived: false,
        },
    });

    if (existingSuperAdmin) {
        return { valid: false, error: 'There can only be one SUPERADMIN' };
    }
}

// Similar check for GLOBAL_ADMIN
// No validation needed for other roles (multiple allowed)
```

### API Endpoints

#### POST `/api/users` (Create User)
```typescript
// Request body
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword",
  "roles": ["CAMPUS_ADMIN", "CAMPUS_LEADER"], // Array of roles
  "departmentId": "campus-id"
}

// Validation happens before creation
const validation = await validateRoleAssignment('new-user', roles, departmentId);
if (!validation.valid) {
  return error; // Prevents creation if SUPERADMIN/GLOBAL_ADMIN already exists
}
```

#### PUT `/api/users/[id]` (Update User)
```typescript
// Request body
{
  "name": "John Doe",
  "roles": ["REGIONAL_ADMIN", "REGIONAL_LEADER"], // Update roles
  "departmentId": "region-id"
}

// Validation happens before update
const validation = await validateRoleAssignment(userId, roles, departmentId);
if (!validation.valid) {
  return error; // Prevents update if constraint violated
}
```

### Error Messages

When trying to create a second SUPERADMIN:
```json
{
  "error": "There can only be one SUPERADMIN. Current SUPERADMIN: admin@example.com"
}
```

When trying to create a second GLOBAL_ADMIN:
```json
{
  "error": "There can only be one GLOBAL_ADMIN. Current GLOBAL_ADMIN: globaladmin@example.com"
}
```

## Database Queries

### Find all users with a specific role in a department
```typescript
const campusAdmins = await prisma.user.findMany({
    where: {
        roles: { has: 'CAMPUS_ADMIN' },
        departmentId: 'campus-id',
        archived: false,
    },
});
```

### Check if a role is unique
```typescript
import { canAssignRole } from '@/lib/roleValidation';

const result = await canAssignRole(userId, 'SUPERADMIN');
if (!result.canAssign) {
    console.log(result.reason); // "There can only be one SUPERADMIN"
}
```

### Get role statistics
```typescript
import { getRoleStats } from '@/lib/roleValidation';

const stats = await getRoleStats();
// Returns: [
//   { role: 'SUPERADMIN', count: 1 },
//   { role: 'GLOBAL_ADMIN', count: 1 },
//   { role: 'CAMPUS_ADMIN', count: 5 },
//   ...
// ]
```

## User Interface Considerations

### Creating Users
When creating a new user:
1. Admin selects roles (can select multiple)
2. System validates roles before creation
3. If SUPERADMIN or GLOBAL_ADMIN is selected and one already exists:
   - Show error message with current holder's name
   - Prevent form submission

### Editing Users
When editing user roles:
1. Admin can add/remove roles
2. System validates before saving
3. If adding SUPERADMIN/GLOBAL_ADMIN and one exists:
   - Show error message
   - Prevent update

### Displaying Users
In user lists:
- Show all roles as chips/badges
- Highlight SUPERADMIN and GLOBAL_ADMIN differently
- Show department name

## Benefits

### 1. Team Collaboration
Multiple admins can share responsibility for a department:
- Coverage during absences
- Workload distribution
- Redundancy and backup

### 2. Flexible Management
Organizations can structure teams as needed:
- Co-leaders
- Primary and backup admins
- Rotation schedules

### 3. Gradual Transitions
Easy leadership changes:
- Add new admin while training
- Overlap period for knowledge transfer
- Remove old admin when ready

### 4. Audit Trail
With multiple admins:
- Track which specific admin performed each action
- Uses `activeRole` in session
- Logged in audit trail

## Testing Checklist

- [ ] Create user with SUPERADMIN role (first one succeeds)
- [ ] Try to create second SUPERADMIN (should fail with error)
- [ ] Create user with GLOBAL_ADMIN role (first one succeeds)
- [ ] Try to create second GLOBAL_ADMIN (should fail with error)
- [ ] Create multiple users with CAMPUS_ADMIN for same campus (should succeed)
- [ ] Create multiple users with REGIONAL_ADMIN for same region (should succeed)
- [ ] Update user to add SUPERADMIN when one exists (should fail)
- [ ] Archive SUPERADMIN and create new one (should succeed)
- [ ] User with multiple roles including CAMPUS_ADMIN works correctly
- [ ] Role switching works for users with multiple admin roles

## Migration Strategy

### Existing Systems
If upgrading from single-role system:

1. **Audit Current Admins**
   ```sql
   SELECT role, departmentId, COUNT(*) as count
   FROM "User"
   WHERE archived = false
   GROUP BY role, departmentId
   HAVING COUNT(*) > 1;
   ```

2. **Identify Conflicts**
   - Check for multiple SUPERADMIN
   - Check for multiple GLOBAL_ADMIN

3. **Resolve Conflicts**
   - Archive or reassign duplicate SUPERADMIN/GLOBAL_ADMIN
   - Keep most senior or active one

4. **Deploy**
   - No conflicts should exist before deploying this feature

## Future Enhancements

1. **Role Assignment Workflow**
   - Approval process for SUPERADMIN changes
   - Notification to current SUPERADMIN when someone tries to create another

2. **Role Limits Configuration**
   - Make role limits configurable
   - Set max admins per department per role

3. **Role Transfer**
   - Direct transfer of SUPERADMIN role
   - Transfer wizard with proper authorization

4. **Analytics**
   - Dashboard showing role distribution
   - Alert for single points of failure (only one admin in critical role)
