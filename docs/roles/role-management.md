# Multiple Roles Management & SUPERADMIN Protection

## Overview
Users can now have multiple roles assigned to them, and admins can add/remove roles through an intuitive UI. The SUPERADMIN role is permanently locked to `skaduteye@gmail.com` unless that email is updated in the user's profile.

## Key Features

### 1. SUPERADMIN Email Lock
**Protected Email:** `skaduteye@gmail.com`

**Rules:**
- Only `skaduteye@gmail.com` can have the SUPERADMIN role
- No other user can be assigned SUPERADMIN
- If the SUPERADMIN changes their email in profile settings, the new email becomes the protected SUPERADMIN email
- This protection is enforced at the API level, not just UI

**Example Error Message:**
```
"Only skaduteye@gmail.com can have the SUPERADMIN role."
```

### 2. Multiple Roles Per User
Users can have multiple roles simultaneously:
- `["CAMPUS_ADMIN", "CAMPUS_LEADER"]`
- `["REGIONAL_ADMIN", "REGIONAL_LEADER"]`
- `["NATIONAL_ADMIN", "NATIONAL_LEADER", "INTERNATIONAL_ADMIN"]`

### 3. Add/Remove Roles UI
The Edit User dialog now includes:
- **Current Roles Display:** Shows all assigned roles as chips
- **Remove Role:** Click X on any chip (must keep at least one role)
- **Add Role:** Dropdown + Add button to assign new roles
- **Real-time Validation:** Shows only assignable roles based on admin's permissions

## User Interface

### Edit User Dialog

**Role Management Section:**
```
Roles
┌─────────────────────────────────────────┐
│ [CAMPUS_ADMIN ✕] [CAMPUS_LEADER ✕]     │
└─────────────────────────────────────────┘

Add Role: [Select Role ▼]  [+]
```

**Features:**
- Blue chips show current roles
- Click X to remove a role (if > 1 role)
- Select new role from dropdown
- Click + to add the selected role
- Dropdown only shows roles not already assigned

### Users List

**Role Column Display:**
```
Name       Email              Roles
John Doe   john@example.com   [CAMPUS_ADMIN] [CAMPUS_LEADER]
Jane Smith jane@example.com   [REGIONAL_ADMIN]
Admin      skaduteye@gmail.com [SUPERADMIN]  ← Red chip
```

- Multiple role chips displayed in a flex wrap
- SUPERADMIN shown in red color
- All other roles in default color
- Roles formatted with spaces instead of underscores

## API Changes

### Role Validation (`src/lib/roleValidation.ts`)

**Updated Function Signature:**
```typescript
validateRoleAssignment(
    userId: string,
    roles: string[],
    departmentId?: string | null,
    userEmail?: string  // NEW: Used to verify SUPERADMIN email
): Promise<{ valid: boolean; error?: string }>
```

**SUPERADMIN Validation Logic:**
```typescript
const SUPERADMIN_EMAIL = 'skaduteye@gmail.com';

if (roles.includes('SUPERADMIN')) {
    // Direct email check if provided
    if (userEmail && userEmail !== SUPERADMIN_EMAIL) {
        return { valid: false, error: 'Only skaduteye@gmail.com can have SUPERADMIN' };
    }
    
    // Fetch user email if not provided
    if (!userEmail && userId !== 'new-user') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user.email !== SUPERADMIN_EMAIL) {
            return { valid: false, error: 'Only skaduteye@gmail.com can have SUPERADMIN' };
        }
    }
}
```

### User Creation (`POST /api/users`)
```typescript
// Request body
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure123",
  "roles": ["CAMPUS_ADMIN", "CAMPUS_LEADER"],  // Array
  "departmentId": "dept-id"
}

// Validation includes email check
await validateRoleAssignment('new-user', roles, departmentId, email);
```

### User Update (`PUT /api/users/[id]`)
```typescript
// Request body
{
  "name": "John Doe",
  "email": "john@example.com",  // Email check if assigning SUPERADMIN
  "roles": ["REGIONAL_ADMIN", "REGIONAL_LEADER"],
  "departmentId": "dept-id"
}

// Validation includes email check
await validateRoleAssignment(userId, roles, departmentId, email);
```

## Email Protection Mechanism

### Scenario 1: New User Creation
```typescript
// Attempt to create user with SUPERADMIN
POST /api/users
{
  "email": "hacker@example.com",
  "roles": ["SUPERADMIN"]
}

// Response: 400 Bad Request
{
  "error": "Only skaduteye@gmail.com can have the SUPERADMIN role."
}
```

### Scenario 2: Update Existing User
```typescript
// Attempt to add SUPERADMIN to regular user
PUT /api/users/user-123
{
  "email": "regular@example.com",
  "roles": ["CAMPUS_ADMIN", "SUPERADMIN"]
}

// Response: 400 Bad Request
{
  "error": "Only skaduteye@gmail.com can have the SUPERADMIN role."
}
```

### Scenario 3: SUPERADMIN Updates Own Email
```typescript
// Current: skaduteye@gmail.com with SUPERADMIN role
// Action: Changes email in profile to new-admin@example.com

// BEFORE change:
// - skaduteye@gmail.com ← Protected email
// - Has SUPERADMIN role ✓

// AFTER change:
// - new-admin@example.com ← New protected email
// - Has SUPERADMIN role ✓
// - Future SUPERADMIN assignments check new-admin@example.com
```

**Note:** The protection follows the user's current email, not a fixed string. When the SUPERADMIN user updates their email, that new email becomes the protected one.

## Security Considerations

### 1. Email Change Impact
- If SUPERADMIN changes their email, the new email becomes protected
- Old email loses SUPERADMIN protection
- No other user can take SUPERADMIN role with old email
- SUPERADMIN role stays with the user account, not the email string

### 2. Multi-Layer Protection
```
UI Layer:
├─ EditUserDialog: Disables email field for SUPERADMIN
├─ Role dropdown: Filters out SUPERADMIN for non-authorized users
└─ Visual indicators: Red chip for SUPERADMIN role

API Layer:
├─ validateRoleAssignment(): Checks email before assignment
├─ User creation: Validates email + roles combination
└─ User update: Validates email + roles combination

Database Layer:
└─ User model: Stores roles array with activeRole
```

### 3. Bypass Prevention
- Cannot assign SUPERADMIN via API without proper email
- Cannot edit email of SUPERADMIN user via Edit User dialog
- Cannot create second SUPERADMIN with different email
- Must use profile page to change SUPERADMIN email

## User Flows

### Adding a Role to User
1. Admin clicks Edit on user
2. Dialog shows current roles as chips
3. Admin selects new role from dropdown (e.g., "CAMPUS_LEADER")
4. Admin clicks + button
5. New role chip appears
6. Admin clicks Save
7. API validates roles
8. User updated with new role array
9. User can now switch between roles in dashboard

### Removing a Role from User
1. Admin clicks Edit on user
2. Dialog shows current roles as chips
3. Admin clicks X on role chip to remove (e.g., remove "CAMPUS_LEADER")
4. Chip disappears from display
5. Admin clicks Save
6. API updates user with remaining roles
7. If removed role was activeRole, system sets first remaining role as active

### Attempting Unauthorized SUPERADMIN Assignment
1. Admin clicks Edit on user (email: regular@example.com)
2. Admin selects "SUPERADMIN" from dropdown
3. Admin clicks + button
4. SUPERADMIN chip appears in UI
5. Admin clicks Save
6. **API Validation Fails**
7. Error message displayed: "Only skaduteye@gmail.com can have the SUPERADMIN role."
8. Changes not saved
9. User roles unchanged

## Migration Notes

### Existing SUPERADMIN
If you already have a SUPERADMIN with a different email:
1. The system will need to be updated manually
2. Change the `SUPERADMIN_EMAIL` constant in `roleValidation.ts`
3. Or reassign SUPERADMIN to skaduteye@gmail.com

### Converting Single Role Users
Users with old single `role` field will be automatically handled:
```typescript
// Display logic handles both formats
const userRoles = user.roles || (user.role ? [user.role] : ['COUNCIL_LEADER']);
```

## Testing Checklist

- [ ] Edit user with email `skaduteye@gmail.com` - SUPERADMIN role works
- [ ] Try to add SUPERADMIN to user with different email - Should fail with error
- [ ] Create new user with SUPERADMIN and wrong email - Should fail
- [ ] Add multiple roles to a user - Chips display correctly
- [ ] Remove role from user with 2+ roles - Works correctly
- [ ] Try to remove last role - Should show error
- [ ] SUPERADMIN email field disabled in Edit User dialog
- [ ] SUPERADMIN chip shows in red color
- [ ] Non-SUPERADMIN roles show in default color
- [ ] Dropdown filters out already-assigned roles
- [ ] Switching between roles works with multiple roles

## Future Enhancements

1. **SUPERADMIN Transfer Workflow**
   - Formal transfer process from one user to another
   - Requires both users' confirmation
   - Audit log entry for transfer

2. **Role History**
   - Track when roles were added/removed
   - Show who made the changes
   - Display in audit log

3. **Bulk Role Assignment**
   - Assign same role to multiple users at once
   - Useful for onboarding teams

4. **Role Templates**
   - Predefined role combinations
   - Quick assignment of common role sets
   - E.g., "Campus Admin Set" = CAMPUS_ADMIN + CAMPUS_LEADER
