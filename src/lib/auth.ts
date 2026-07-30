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

type AuthClaims = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  roles: string[];
  organisationId: string | undefined;
  organisationLevel: string | undefined;
  organisationName: string | undefined;
  activeUserRoleId: string | null;
  activeUserRole: { id: string; role: string; organisationId: string } | null;
};

/**
 * Load authoritative role/org claims from the DB.
 * JWT is a session carrier only — claims are revalidated from here.
 * Throws on missing/archived users so callers can fail closed.
 */
async function loadAuthClaimsFromDb(userId: string): Promise<AuthClaims> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organisation: true,
      activeUserRole: { include: { organisation: true } },
      userRoles: { include: { organisation: true } },
    },
  });

  if (!dbUser || dbUser.archived) {
    throw new Error('User account is no longer active');
  }

  const allRoles = dbUser.userRoles
    .map((ur) => ur.role)
    .filter((r): r is Role => r !== null);
  const isSuperUser =
    dbUser.activeRole === 'SUPERADMIN' || dbUser.activeRole === 'DENOMINATION_ADMIN';

  if (isSuperUser) {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
      role: dbUser.activeRole as string,
      roles: allRoles.length > 0 ? (allRoles as string[]) : [dbUser.activeRole as string],
      organisationId: dbUser.organisationId || undefined,
      organisationLevel: dbUser.organisation?.level || undefined,
      organisationName: dbUser.organisation?.name || undefined,
      activeUserRoleId: dbUser.activeUserRoleId || null,
      activeUserRole: dbUser.activeUserRole
        ? {
            id: dbUser.activeUserRole.id,
            role: dbUser.activeUserRole.role as string,
            organisationId: dbUser.activeUserRole.organisationId,
          }
        : null,
    };
  }

  if (dbUser.userRoles.length === 0) {
    throw new Error('User account is no longer active');
  }

  const activeRole = dbUser.activeUserRole || dbUser.userRoles[0];
  if (!activeRole?.role) {
    throw new Error('User account is no longer active');
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    image: dbUser.image,
    role: activeRole.role as string,
    roles: allRoles as string[],
    organisationId: activeRole.organisationId,
    organisationLevel: activeRole.organisation?.level || undefined,
    organisationName: activeRole.organisation?.name || undefined,
    activeUserRoleId: activeRole.id,
    activeUserRole: {
      id: activeRole.id,
      role: activeRole.role as string,
      organisationId: activeRole.organisationId,
    },
  };
}

function applyClaimsToToken(token: Record<string, unknown>, claims: AuthClaims) {
  token.id = claims.id;
  token.email = claims.email;
  token.name = claims.name;
  token.picture = claims.image;
  token.role = claims.role;
  token.roles = claims.roles;
  token.organisationId = claims.organisationId;
  token.organisationLevel = claims.organisationLevel;
  token.organisationName = claims.organisationName;
  token.activeUserRoleId = claims.activeUserRoleId;
  token.activeUserRole = claims.activeUserRole;
}

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
                    include: { organisation: true,
                        activeUserRole: {
                            include: { organisation: true,
                            },
                        },
                        userRoles: {
                            include: { organisation: true,
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
                        organisationId: user.organisationId || undefined,
                        organisationLevel: user.organisation?.level || undefined,
                        organisationName: user.organisation?.name,
                        activeUserRoleId: user.activeUserRoleId || undefined,
                        activeUserRole: user.activeUserRole ? {
                            id: user.activeUserRole.id,
                            role: user.activeUserRole.role as string,
                            organisationId: user.activeUserRole.organisationId,
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
                    organisationId: activeRole.organisationId,
                    organisationLevel: activeRole.organisation?.level,
                    organisationName: activeRole.organisation?.name,
                    activeUserRoleId: activeRole.id,
                    activeUserRole: {
                        id: activeRole.id,
                        role: activeRole.role as string,
                        organisationId: activeRole.organisationId,
                    },
                } as any;
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if ((token as any).expired || !token.id || !token.email) {
                throw new Error('Session expired or invalid');
            }

            // Fail closed: every session read reloads role/org from DB.
            // JWT is only a carrier for id + expiry + impersonation flags.
            try {
                const claims = await loadAuthClaimsFromDb(token.id as string);
                session.user.id = claims.id;
                session.user.name = claims.name as string;
                session.user.email = claims.email as string;
                session.user.image = claims.image as string;
                session.user.role = claims.role;
                session.user.roles = claims.roles;
                session.user.organisationId = claims.organisationId as string;
                session.user.organisationLevel = claims.organisationLevel as string;
                session.user.organisationName = claims.organisationName as string;
                session.user.activeUserRoleId = claims.activeUserRoleId;
                session.user.activeUserRole = claims.activeUserRole as any;
                session.user.loginAt = token.loginAt as number;
                session.user.isImpersonating = token.isImpersonating as boolean | undefined;
                session.user.originalAdminId = token.originalAdminId as string | undefined;
                session.user.originalAdminName = token.originalAdminName as string | undefined;
            } catch (error) {
                if (error instanceof Error && (
                    error.message === 'User account is no longer active' ||
                    error.message === 'Session expired or invalid'
                )) {
                    throw error;
                }
                console.error('Session revalidation failed (fail-closed):', error);
                throw new Error('Session expired or invalid');
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
                token.organisationId = user.organisationId;
                token.organisationLevel = user.organisationLevel;
                token.organisationName = user.organisationName;
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
                if ((session as any)?.stopImpersonation === true && token.isImpersonating && token.originalAdminId) {
                    try {
                        const claims = await loadAuthClaimsFromDb(token.originalAdminId as string);
                        applyClaimsToToken(token as any, claims);
                        token.isImpersonating = undefined;
                        token.originalAdminId = undefined;
                        token.originalAdminEmail = undefined;
                        token.originalAdminName = undefined;
                    } catch {
                        return { expired: true } as any;
                    }
                    return token;
                }

                // Handle start impersonation — only SUPERADMIN may do this
                if ((session as any)?.impersonateUserId && token.role === 'SUPERADMIN') {
                    try {
                        const claims = await loadAuthClaimsFromDb((session as any).impersonateUserId as string);
                        const origAdminId = token.id as string;
                        const origAdminEmail = token.email as string;
                        const origAdminName = token.name as string;
                        applyClaimsToToken(token as any, claims);
                        token.isImpersonating = true;
                        token.originalAdminId = origAdminId;
                        token.originalAdminEmail = origAdminEmail;
                        token.originalAdminName = origAdminName;
                    } catch {
                        // Keep admin token if target cannot be loaded
                    }
                    return token;
                }

                // Role switch / profile refresh — reload claims from DB
                try {
                    const claims = await loadAuthClaimsFromDb(token.id as string);
                    applyClaimsToToken(token as any, claims);
                } catch {
                    return { expired: true } as any;
                }
                return token;
            }

            // Periodic revalidation: refresh claims from DB on every JWT pass
            // so revoked roles / org moves take effect without waiting for update().
            if (token.id && !user) {
                try {
                    const claims = await loadAuthClaimsFromDb(token.id as string);
                    applyClaimsToToken(token as any, claims);
                } catch {
                    return { expired: true } as any;
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
