import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * In-memory account lockout tracker.
 * Tracks failed login attempts per identifier and locks accounts after 5 failures.
 */
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkAccountLockout(identifier: string): { locked: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(identifier);
  if (!entry) return { locked: false };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }

  // Lockout expired, reset
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(identifier);
    return { locked: false };
  }

  return { locked: false };
}

function recordFailedLogin(identifier: string): void {
  const entry = loginAttempts.get(identifier) || { count: 0, lockedUntil: null };
  entry.count++;

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(identifier, entry);
}

function clearLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

// Cleanup stale lockout entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.lockedUntil && now > entry.lockedUntil) {
      loginAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000).unref?.();

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt',
        maxAge: 4 * 60 * 60, // 4 hours for all users
    },
    pages: {
        signIn: '/auth/login',
        signOut: '/auth/login',
    },
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email or Phone', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const loginIdentifier = credentials.email.toLowerCase().trim();
                
                // Check account lockout
                const lockout = checkAccountLockout(loginIdentifier);
                if (lockout.locked) {
                    throw new Error('Account temporarily locked due to too many failed login attempts. Please try again in 15 minutes.');
                }
                
                // Determine if input is email or phone
                const isEmail = loginIdentifier.includes('@');
                
                // Build the query based on input type
                const user = await prisma.user.findFirst({
                    where: {
                        ...(isEmail 
                            ? { email: loginIdentifier }
                            : { phone: loginIdentifier }),
                        archived: false,
                    },
                    include: {
                        department: true,
                        activeUserRole: {
                            include: {
                                department: true,
                            },
                        },
                        userRoles: {
                            include: {
                                department: true,
                            },
                        },
                    },
                });

                if (!user) {
                    recordFailedLogin(loginIdentifier);
                    return null;
                }

                if (!user.password) {
                    recordFailedLogin(loginIdentifier);
                    return null;
                }

                // Verify password
                const isValid = await bcrypt.compare(credentials.password, user.password);

                if (!isValid) {
                    recordFailedLogin(loginIdentifier);
                    return null;
                }

                // Successful login - clear any lockout tracking
                clearLoginAttempts(loginIdentifier);

                // SUPERADMIN users may not have UserRole entries (legacy setup)
                // Check if user has a direct activeRole set
                if (user.activeRole === 'SUPERADMIN' || user.activeRole === 'DENOMINATION_ADMIN') {
                    const allRoles = user.userRoles.length > 0 
                        ? user.userRoles.map(ur => ur.role).filter((r): r is Role => r !== null)
                        : (user.activeRole ? [user.activeRole] : []);
                    
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.activeRole,
                        roles: allRoles as string[],
                        departmentId: user.departmentId || undefined,
                        departmentLevel: user.department?.level || undefined,
                        departmentName: user.department?.name,
                        activeUserRoleId: user.activeUserRoleId || undefined,
                        activeUserRole: user.activeUserRole ? {
                            id: user.activeUserRole.id,
                            role: user.activeUserRole.role as string,
                            departmentId: user.activeUserRole.departmentId,
                        } : undefined,
                    } as any;
                }

                // For other users, they need at least one UserRole entry
                if (user.userRoles.length === 0) {
                    return null;
                }

                // Use activeUserRole if set, otherwise use first userRole
                const activeRole = user.activeUserRole || user.userRoles[0];
                const allRoles: Role[] = user.userRoles.map(ur => ur.role).filter((r): r is Role => r !== null);

                if (!activeRole) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: activeRole.role,
                    roles: allRoles as string[],
                    departmentId: activeRole.departmentId,
                    departmentLevel: activeRole.department?.level,
                    departmentName: activeRole.department?.name,
                    activeUserRoleId: activeRole.id,
                    activeUserRole: {
                        id: activeRole.id,
                        role: activeRole.role as string,
                        departmentId: activeRole.departmentId,
                    },
                } as any;
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token) {
                // If the token was marked expired or lacks essential fields,
                // throw immediately so NextAuth returns no session to the client.
                if ((token as any).expired || !token.id || !token.email) {
                    throw new Error('Session expired or invalid');
                }

                // Validate that the user still exists and is active
                // This check happens on every session access
                try {
                    const user = await prisma.user.findUnique({
                        where: { email: token.email as string },
                        select: { 
                            id: true, 
                            archived: true,
                        },
                    });
                    
                    // If user doesn't exist or is archived, throw error to invalidate session
                    // This will cause NextAuth to clear the session on the client side
                    if (!user || user.archived) {
                        console.log('Session invalidated: User is archived or deleted');
                        throw new Error('User account is no longer active');
                    }
                } catch (error) {
                    if (error instanceof Error && (
                        error.message === 'User account is no longer active' ||
                        error.message === 'Session expired or invalid'
                    )) {
                        // Re-throw our intentional errors to invalidate the session
                        throw error;
                    }
                    // For other errors, log but continue with session to avoid breaking the app
                    console.error('Error checking user status in session callback:', error);
                }
                
                session.user.id = token.id as string;
                session.user.name = token.name as string;
                session.user.email = token.email as string;
                session.user.image = token.picture as string;
                session.user.role = token.role as string;
                session.user.roles = token.roles as string[];
                session.user.departmentId = token.departmentId as string;
                session.user.departmentLevel = token.departmentLevel as string;
                session.user.departmentName = token.departmentName as string;
                session.user.activeUserRoleId = token.activeUserRoleId as string | null;
                session.user.activeUserRole = token.activeUserRole as any;
                session.user.loginAt = token.loginAt as number;
                // Impersonation fields
                session.user.isImpersonating = token.isImpersonating as boolean | undefined;
                session.user.originalAdminId = token.originalAdminId as string | undefined;
                session.user.originalAdminName = token.originalAdminName as string | undefined;
            }
            return session;
        },
        async jwt({ token, user, trigger, session }) {
            // If the token was previously invalidated (no id) and this isn't
            // a fresh sign-in, keep it invalidated so the phantom can't recover.
            if (!token.id && !user) {
                return { expired: true } as any;
            }

            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.picture = user.image;
                token.role = user.role;
                token.roles = user.roles;
                token.departmentId = user.departmentId;
                token.departmentLevel = user.departmentLevel;
                token.departmentName = user.departmentName;
                token.activeUserRoleId = user.activeUserRoleId;
                token.activeUserRole = user.activeUserRole;
                token.loginAt = Date.now();
            }

            // Check session expiry — 4 hours for all users
            if (token.loginAt) {
                const elapsed = Date.now() - (token.loginAt as number);
                const maxDuration = 4 * 60 * 60 * 1000; // 4 hours
                if (elapsed > maxDuration) {
                    // Return a clearly-marked expired token so subsequent
                    // requests don't accidentally treat it as valid.
                    return { expired: true } as any;
                }
            }
            
            // Handle session update (e.g., when switching roles)
            // This runs when update() is called from the client
            if (trigger === 'update') {
                // Handle stop impersonation
                if ((session as any)?.stopImpersonation === true && token.isImpersonating && token.originalAdminEmail) {
                    const adminUser = await prisma.user.findUnique({
                        where: { email: token.originalAdminEmail as string },
                        include: {
                            department: true,
                            activeUserRole: { include: { department: true } },
                            userRoles: { include: { department: true } },
                        },
                    });

                    if (adminUser && !adminUser.archived) {
                        const allRoles = adminUser.userRoles.map(ur => ur.role).filter((r): r is Role => r !== null);
                        token.id = adminUser.id;
                        token.email = adminUser.email;
                        token.name = adminUser.name;
                        token.picture = adminUser.image;
                        token.role = adminUser.activeRole as string;
                        token.roles = allRoles.length > 0 ? allRoles : [adminUser.activeRole as string];
                        token.departmentId = adminUser.departmentId;
                        token.departmentLevel = adminUser.department?.level || undefined;
                        token.departmentName = adminUser.department?.name;
                        token.activeUserRoleId = adminUser.activeUserRoleId || null;
                        token.activeUserRole = adminUser.activeUserRole ? {
                            id: adminUser.activeUserRole.id,
                            role: adminUser.activeUserRole.role as string,
                            departmentId: adminUser.activeUserRole.departmentId,
                        } : null;
                        // Clear impersonation fields
                        token.isImpersonating = undefined;
                        token.originalAdminId = undefined;
                        token.originalAdminEmail = undefined;
                        token.originalAdminName = undefined;
                    }
                    return token;
                }

                // Handle start impersonation — only SUPERADMIN may do this
                if ((session as any)?.impersonateUserId && token.role === 'SUPERADMIN') {
                    const targetUser = await prisma.user.findUnique({
                        where: { id: (session as any).impersonateUserId as string },
                        include: {
                            department: true,
                            activeUserRole: { include: { department: true } },
                            userRoles: { include: { department: true } },
                        },
                    });

                    if (targetUser && !targetUser.archived) {
                        const allRoles = targetUser.userRoles.map(ur => ur.role).filter((r): r is Role => r !== null);
                        const isSuperUser = targetUser.activeRole === 'SUPERADMIN' || targetUser.activeRole === 'DENOMINATION_ADMIN';

                        // Store original admin identity before switching
                        const origAdminId = token.id as string;
                        const origAdminEmail = token.email as string;
                        const origAdminName = token.name as string;

                        token.isImpersonating = true;
                        token.originalAdminId = origAdminId;
                        token.originalAdminEmail = origAdminEmail;
                        token.originalAdminName = origAdminName;

                        token.id = targetUser.id;
                        token.email = targetUser.email;
                        token.name = targetUser.name;
                        token.picture = targetUser.image;

                        if (isSuperUser) {
                            token.role = targetUser.activeRole as string;
                            token.roles = allRoles.length > 0 ? allRoles : [targetUser.activeRole as string];
                            token.departmentId = targetUser.departmentId;
                            token.departmentLevel = targetUser.department?.level || undefined;
                            token.departmentName = targetUser.department?.name;
                            token.activeUserRoleId = targetUser.activeUserRoleId || null;
                            token.activeUserRole = targetUser.activeUserRole ? {
                                id: targetUser.activeUserRole.id,
                                role: targetUser.activeUserRole.role as string,
                                departmentId: targetUser.activeUserRole.departmentId,
                            } : null;
                        } else {
                            const activeRole = targetUser.activeUserRole || targetUser.userRoles[0];
                            token.role = activeRole?.role || 'COUNCIL_LEADER';
                            token.roles = allRoles;
                            token.departmentId = activeRole?.departmentId;
                            token.departmentLevel = activeRole?.department?.level || undefined;
                            token.departmentName = activeRole?.department?.name || undefined;
                            token.activeUserRoleId = activeRole?.id || null;
                            token.activeUserRole = activeRole ? {
                                id: activeRole.id,
                                role: activeRole.role as string,
                                departmentId: activeRole.departmentId,
                            } : null;
                        }
                    }
                    return token;
                }

                // Fetch fresh user data to get updated activeUserRole
                const updatedUser = await prisma.user.findUnique({
                    where: { email: token.email as string },
                    include: {
                        department: true,
                        activeUserRole: {
                            include: {
                                department: true,
                            },
                        },
                        userRoles: {
                            include: {
                                department: true,
                            },
                        },
                    },
                });

                if (updatedUser && !updatedUser.archived) {
                    const allRoles = updatedUser.userRoles.map(ur => ur.role).filter((r): r is Role => r !== null);
                    const isSuperUserOnUpdate = updatedUser.activeRole === 'SUPERADMIN' || updatedUser.activeRole === 'DENOMINATION_ADMIN';

                    // Always update name and image
                    token.name = updatedUser.name;
                    token.picture = updatedUser.image;

                    if (isSuperUserOnUpdate) {
                        token.id = updatedUser.id;
                        token.role = updatedUser.activeRole as string;
                        token.roles = allRoles.length > 0 ? allRoles : [updatedUser.activeRole as string];
                        token.departmentId = updatedUser.departmentId;
                        token.departmentLevel = updatedUser.department?.level || undefined;
                        token.departmentName = updatedUser.department?.name;
                        token.activeUserRoleId = updatedUser.activeUserRoleId || null;
                        token.activeUserRole = updatedUser.activeUserRole ? {
                            id: updatedUser.activeUserRole.id,
                            role: updatedUser.activeUserRole.role as string,
                            departmentId: updatedUser.activeUserRole.departmentId,
                        } : null;
                    } else {
                        const activeRole = updatedUser.activeUserRole || updatedUser.userRoles[0];

                        token.id = updatedUser.id;
                        token.role = activeRole?.role || 'COUNCIL_LEADER';
                        token.roles = allRoles;
                        token.departmentId = activeRole?.departmentId;
                        token.departmentLevel = activeRole?.department?.level || undefined;
                        token.departmentName = activeRole?.department?.name || undefined;
                        token.activeUserRoleId = activeRole?.id || null;
                        token.activeUserRole = activeRole ? {
                            id: activeRole.id,
                            role: activeRole.role as string,
                            departmentId: activeRole.departmentId,
                        } : null;
                    }
                }
            }
            
            return token;
        },
    },
    events: {
        async signIn({ user }) {
            try {
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        actionType: 'LOGIN',
                        entityType: 'User',
                        entityId: user.id,
                        description: 'User logged in',
                        severity: 'LOW',
                        success: true,
                    },
                });
            } catch (error) {
                console.error('Failed to log login event:', error);
            }
        },
        async signOut({ token }) {
            try {
                // Log the logout event for audit trail
                if (token?.id) {
                    await prisma.auditLog.create({
                        data: {
                            userId: token.id as string,
                            actionType: 'LOGOUT',
                            entityType: 'User',
                            entityId: token.id as string,
                            description: 'User logged out',
                            severity: 'LOW',
                            success: true,
                        },
                    });
                }
            } catch (error) {
                console.error('Failed to log logout event:', error);
            }
        },
    },
};
