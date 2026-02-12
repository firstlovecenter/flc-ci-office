import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
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
                    return null;
                }

                if (!user.password) {
                    return null;
                }

                // Verify password
                const isValid = await bcrypt.compare(credentials.password, user.password);

                if (!isValid) {
                    return null;
                }

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
            }
            return session;
        },
        async jwt({ token, user, trigger, session }) {
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
            }
            
            // Handle session update (e.g., when switching roles)
            // This runs when update() is called from the client
            if (trigger === 'update') {
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
                
                if (updatedUser) {
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
    },
};
