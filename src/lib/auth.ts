import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    console.error('Missing credentials');
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email,
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
                    console.error('User not found:', credentials.email);
                    return null;
                }

                if (!user.password) {
                    console.error('User has no password set:', credentials.email);
                    return null;
                }

                // Verify password
                const isValid = await bcrypt.compare(credentials.password, user.password);

                if (!isValid) {
                    console.error('Invalid password for user:', credentials.email);
                    return null;
                }

                // SUPERADMIN and GLOBAL_ADMIN can work without UserRole entries
                const isSuperUser = user.roles.includes('SUPERADMIN') || user.roles.includes('GLOBAL_ADMIN');
                
                if (isSuperUser && user.userRoles.length === 0) {
                    // Super users don't need UserRole entries
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.roles.includes('SUPERADMIN') ? 'SUPERADMIN' : 'GLOBAL_ADMIN',
                        roles: user.roles,
                        departmentId: user.departmentId || undefined,
                        departmentLevel: undefined,
                    };
                }

                // Use activeUserRole if set, otherwise use first userRole
                const activeRole = user.activeUserRole || user.userRoles[0];
                const allRoles = user.userRoles.map(ur => ur.role);

                if (!activeRole) {
                    console.error('No active role found for user:', user.email);
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: activeRole.role,
                    roles: allRoles,
                    departmentId: activeRole.departmentId,
                    departmentLevel: activeRole.department?.level,
                };
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.roles = token.roles as string[];
                session.user.departmentId = token.departmentId as string;
                session.user.departmentLevel = token.departmentLevel as string;
            }
            return session;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.roles = user.roles;
                token.departmentId = user.departmentId;
                token.departmentLevel = user.departmentLevel;
            }
            
            // Handle session update (e.g., when switching roles)
            // This runs when update() is called from the client
            if (trigger === 'update') {
                // Fetch fresh user data to get updated activeUserRole
                const updatedUser = await prisma.user.findUnique({
                    where: { email: token.email as string },
                    include: {
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
                    const isSuperUserOnUpdate = updatedUser.roles.includes('SUPERADMIN') || updatedUser.roles.includes('GLOBAL_ADMIN');
                    
                    if (isSuperUserOnUpdate && updatedUser.userRoles.length === 0) {
                        token.id = updatedUser.id;
                        token.role = updatedUser.roles.includes('SUPERADMIN') ? 'SUPERADMIN' : 'GLOBAL_ADMIN';
                        token.roles = updatedUser.roles;
                        token.departmentId = updatedUser.departmentId;
                        token.departmentLevel = undefined;
                    } else {
                        const activeRole = updatedUser.activeUserRole || updatedUser.userRoles[0];
                        const allRoles = updatedUser.userRoles.map(ur => ur.role);
                        
                        token.id = updatedUser.id;
                        token.role = activeRole?.role || 'COUNCIL_LEADER';
                        token.roles = allRoles;
                        token.departmentId = activeRole?.departmentId;
                        token.departmentLevel = activeRole?.department?.level;
                    }
                }
            }
            
            return token;
        },
    },
};
