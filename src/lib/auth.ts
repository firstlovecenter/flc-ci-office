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
                    return null;
                }

                // TODO: Implement password hashing verification
                // For now, we'll just check if the password matches (INSECURE - FIX LATER)
                const isValid = await bcrypt.compare(credentials.password, user.password || '');

                if (!isValid) {
                    return null;
                }

                // Use activeUserRole if set, otherwise use first userRole
                const activeRole = user.activeUserRole || user.userRoles[0];
                const allRoles = user.userRoles.map(ur => ur.role);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: activeRole?.role || 'COUNCIL_LEADER',
                    roles: allRoles,
                    departmentId: activeRole?.departmentId ?? undefined,
                    departmentLevel: activeRole?.department?.level,
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
                    const activeRole = updatedUser.activeUserRole || updatedUser.userRoles[0];
                    const allRoles = updatedUser.userRoles.map(ur => ur.role);
                    
                    token.id = updatedUser.id;
                    token.role = activeRole?.role || 'COUNCIL_LEADER';
                    token.roles = allRoles;
                    token.departmentId = activeRole?.departmentId;
                    token.departmentLevel = activeRole?.department?.level;
                }
            }
            
            return token;
        },
    },
};
