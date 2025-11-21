# Multiple Roles Implementation

## Overview
Users can now have multiple roles assigned to them. When logging in, users with multiple roles will be prompted to select which role they want to use for that session. Users with a single role will bypass the selection page and go directly to the dashboard.

## Database Schema Changes

### User Model
```prisma
model User {
  roles      Role[]  @default([COUNCIL_LEADER])  // Array of roles
  activeRole Role?                                // Current session role
  // ... other fields
}
```

- **`roles`**: Array of all roles assigned to the user
- **`activeRole`**: The role currently being used in the session

## User Flow

### Login Process
1. User enters credentials on login page
2. After successful authentication:
   - If user has **1 role**: Redirect to `/dashboard`
   - If user has **2+ roles**: Redirect to `/select-role`

### Role Selection Page (`/select-role`)
- Displays all available roles as clickable cards
- Each card shows:
  - Role icon
  - Role name (formatted)
  - Role description
- Clicking a role:
  1. Calls `/api/users/select-role` to update `activeRole` in database
  2. Updates session with selected role
  3. Redirects to `/dashboard`

### Role Switching (In-App)
- **RoleSwitcher** component in dashboard header
- Click swap icon to open role menu
- Select different role to switch
- Page refreshes with new permissions

## API Endpoints

### POST `/api/users/select-role`
Updates the active role for the current user.

**Request Body:**
```json
{
  "role": "CAMPUS_ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "role": "CAMPUS_ADMIN"
}
```

**Validations:**
- Verifies user is authenticated
- Checks that requested role is in user's `roles` array
- Updates `activeRole` in database

## Authentication Changes

### NextAuth Configuration (`src/lib/auth.ts`)

**authorize callback:**
```typescript
return {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.activeRole || user.roles[0] || 'COUNCIL_LEADER',  // Use activeRole or first role
  roles: user.roles,  // Include all roles
  departmentId: user.departmentId ?? undefined,
  departmentLevel: user.department?.level,
};
```

**jwt callback:**
```typescript
async jwt({ token, user, trigger, session }) {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.roles = user.roles;  // Store roles array
    // ... other fields
  }
  
  // Handle session update (role switching)
  if (trigger === 'update' && session?.user) {
    const updatedUser = await prisma.user.findUnique({
      where: { email: token.email },
      include: { department: true },
    });
    
    if (updatedUser) {
      token.role = updatedUser.activeRole || updatedUser.roles[0];
      token.roles = updatedUser.roles;
    }
  }
  
  return token;
}
```

**session callback:**
```typescript
async session({ session, token }) {
  if (token) {
    session.user.id = token.id;
    session.user.role = token.role;  // Current active role
    session.user.roles = token.roles;  // All roles
    // ... other fields
  }
  return session;
}
```

### Type Definitions (`src/types/next-auth.d.ts`)
```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;      // Current active role
      roles: string[];   // All assigned roles
      // ... other fields
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    roles: string[];
    // ... other fields
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    roles: string[];
    // ... other fields
  }
}
```

## Components

### RoleSwitcher (`src/components/RoleSwitcher.tsx`)
**Location:** Dashboard header (next to user avatar)

**Features:**
- Shows swap icon button
- Opens menu with all user's roles
- Current role is highlighted with checkmark
- Clicking a role:
  1. Calls `/api/users/select-role`
  2. Updates session using `update()` from next-auth
  3. Refreshes page with `router.refresh()`

**Behavior:**
- Only visible if `session.user.roles.length > 1`
- Disabled while switching (prevents double-clicks)

### SelectRolePage (`src/app/select-role/page.tsx`)
**Route:** `/select-role`

**Features:**
- Displays user avatar and welcome message
- Grid of role cards
- Each card shows:
  - Circular icon with role symbol
  - Role chip
  - Role description
- Loading states for role selection

**Auto-redirect:**
- If user has only 1 role, automatically selects it and redirects to dashboard
- Runs in `useEffect` on mount

## Permission Handling

### Current Implementation
All permission checks throughout the app should use `session.user.role` which represents the **active role**.

**Example:**
```typescript
const isAdmin = session?.user?.role === 'CAMPUS_ADMIN';
const canApprove = ['CAMPUS_ADMIN', 'REGIONAL_ADMIN'].includes(session?.user?.role);
```

### Future Consideration
The `session.user.roles` array could be used for:
- Showing different UI based on all user's roles
- Displaying role badges
- Allowing users to see what permissions they could have

However, **authorization should always check `activeRole`**, not the entire `roles` array.

## Migration

### Database Migration
The schema change from single `role` to `roles[]` was applied using:
```bash
npx prisma db push --accept-data-loss
```

**Note:** This caused data loss of the old `role` column. Existing users were reset to the default `[COUNCIL_LEADER]` role.

### Data Migration Script
`scripts/migrate-roles.ts` - Can be used to:
1. Fetch users from database
2. Set appropriate roles based on business logic
3. Set `activeRole` to first role in array

## Testing Checklist

- [ ] User with 1 role logs in → Goes directly to dashboard
- [ ] User with 2+ roles logs in → Redirected to role selection page
- [ ] Role selection page displays all user's roles correctly
- [ ] Clicking a role updates session and redirects to dashboard
- [ ] RoleSwitcher appears in dashboard for multi-role users
- [ ] RoleSwitcher doesn't appear for single-role users
- [ ] Switching roles updates permissions correctly
- [ ] Page refreshes after role switch
- [ ] Session persists after page reload

## Benefits

1. **Single Account**: Users don't need multiple accounts for different roles
2. **Flexible Permissions**: Users can switch contexts easily
3. **Better UX**: Clear visual indication of current role
4. **Security**: Only one role active at a time
5. **Audit Trail**: Can track which role performed which action (via `activeRole`)

## Future Enhancements

1. **Role History**: Track role switches in audit log
2. **Default Role**: Let users set a preferred default role
3. **Time-based Roles**: Automatically switch roles based on schedule
4. **Role Badges**: Show all user's roles in profile
5. **Quick Switch**: Remember last N roles for faster switching
