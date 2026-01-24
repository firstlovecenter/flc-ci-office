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
                    where: isEmail 
                        ? { email: loginIdentifier }
                        : { phone: loginIdentifier },
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

                // SUPERADMIN and GLOBAL_ADMIN can work without UserRole entries
                const isSuperUser = user.roles.includes('SUPERADMIN') || user.roles.includes('GLOBAL_ADMIN');
                
                if (isSuperUser && user.userRoles.length === 0) {
                    // Super users don't need UserRole entries
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.roles.includes('SUPERADMIN') ? 'SUPERADMIN' : 'GLOBAL_ADMIN',
                        roles: user.roles,
                        departmentId: user.departmentId || undefined,
                        departmentLevel: undefined,
                        departmentName: user.department?.name,
                    };
                }

                // Use activeUserRole if set, otherwise use first userRole
                const activeRole = user.activeUserRole || user.userRoles[0];
                const allRoles = user.userRoles.map(ur => ur.role);

                if (!activeRole) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: activeRole.role,
                    roles: allRoles,
                    departmentId: activeRole.departmentId,
                    departmentLevel: activeRole.department?.level,
                    departmentName: activeRole.department?.name,
                    activeUserRoleId: activeRole.id,
                    activeUserRole: {
                        id: activeRole.id,
                        role: activeRole.role,
                        departmentId: activeRole.departmentId,
                    },
                };
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
                    const isSuperUserOnUpdate = updatedUser.roles.includes('SUPERADMIN') || updatedUser.roles.includes('GLOBAL_ADMIN');
                    
                    // Always update name and image
                    token.name = updatedUser.name;
                    token.picture = updatedUser.image;
                    
                    if (isSuperUserOnUpdate && updatedUser.userRoles.length === 0) {
                        token.id = updatedUser.id;
                        token.role = updatedUser.roles.includes('SUPERADMIN') ? 'SUPERADMIN' : 'GLOBAL_ADMIN';
                        token.roles = updatedUser.roles;
                        token.departmentId = updatedUser.departmentId;
                        token.departmentLevel = undefined;
                        token.departmentName = updatedUser.department?.name;
                        token.activeUserRoleId = null;
                        token.activeUserRole = null;
                    } else {
                        const activeRole = updatedUser.activeUserRole || updatedUser.userRoles[0];
                        const allRoles = updatedUser.userRoles.map(ur => ur.role);
                        
                        token.id = updatedUser.id;
                        token.role = activeRole?.role || 'COUNCIL_LEADER';
                        token.roles = allRoles;
                        token.departmentId = activeRole?.departmentId;
                        token.departmentLevel = activeRole?.department?.level;
                        token.departmentName = activeRole?.department?.name;
                        token.activeUserRoleId = activeRole?.id || null;
                        token.activeUserRole = activeRole ? {
                            id: activeRole.id,
                            role: activeRole.role,
                            departmentId: activeRole.departmentId,
                        } : null;
                    }
                }
            }
            
            return token;
        },
    },
};
