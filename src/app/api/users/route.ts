import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { validateRoleAssignment } from '@/lib/roleValidation';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can list users
    // TODO: Add more granular checks
    if (!['SUPERADMIN', 'GLOBAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        let whereClause: any = {
            archived: false, // Only show non-archived users by default
        };

        // Filter users based on department hierarchy
        if (session.user.role !== 'SUPERADMIN') {
            if (session.user.departmentId) {
                const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
                whereClause.departmentId = { in: allowedDepartmentIds };
            } else {
                // User has no department, can't see any users
                return NextResponse.json([]);
            }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: {
                department: true,
                baseCurrency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
                userRoles: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                level: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Remove passwords from response
        const safeUsers = users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });

        return NextResponse.json(safeUsers);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user has admin role
    const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
        return new NextResponse('Forbidden - Admin role required', { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, name, email, password, roleDepartmentPairs } = body;

        if (!roleDepartmentPairs || roleDepartmentPairs.length === 0) {
            return NextResponse.json({ error: 'At least one role-department pair is required' }, { status: 400 });
        }

        // Extract unique roles for backward compatibility validation
        const userRoles: string[] = Array.from(new Set(roleDepartmentPairs.map((pair: any) => pair.role as string)));
        const firstDept = roleDepartmentPairs[0].departmentId;

        // Validate role assignments (check SUPERADMIN and GLOBAL_ADMIN uniqueness)
        const validation = await validateRoleAssignment('new-user', userRoles, firstDept, email);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return new NextResponse('User already exists', { status: 400 });
        }

        // For non-superadmins, verify they can create users in the target department
        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return new NextResponse('Forbidden - No department assigned', { status: 403 });
            }

            // Get all departments this admin oversees
            const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
            
            // Verify all target departments are within their scope
            for (const pair of roleDepartmentPairs) {
                if (!allowedDepartmentIds.includes(pair.departmentId)) {
                    return new NextResponse('Forbidden - Cannot create user in this department', { status: 403 });
                }
            }

            // Verify the role being assigned is appropriate for the admin's level
            // Admins can only assign roles at their level or below
            const userDept = firstDept ? await prisma.department.findUnique({ where: { id: firstDept } }) : null;
            const adminDept = await prisma.department.findUnique({ where: { id: session.user.departmentId } });
            
            if (userDept && adminDept) {
                const DEPARTMENT_HIERARCHY: Record<string, number> = {
                    GLOBAL: 1,
                    INTERNATIONAL: 2,
                    NATIONAL: 3,
                    REGIONAL: 4,
                    CAMPUS: 5,
                    STREAM: 6,
                    COUNCIL: 7,
                };

                const userDeptLevel = DEPARTMENT_HIERARCHY[userDept.level];
                const adminDeptLevel = DEPARTMENT_HIERARCHY[adminDept.level];

                // User department must be at admin's level or below
                if (userDeptLevel < adminDeptLevel) {
                    return new NextResponse('Forbidden - Cannot create user at higher department level', { status: 403 });
                }
            }
        }

        // Create the user first with backward compatibility fields
        const user = await prisma.user.create({
            data: {
                title: title?.trim() || null,
                name,
                email,
                password: await bcrypt.hash(password, 10),
                roles: userRoles as any, // Keep for backward compatibility during migration
                activeRole: userRoles[0] as any, // Keep for backward compatibility during migration
                departmentId: firstDept, // Set to first department for backward compatibility
            },
        });

        // Create UserRole entries for each role-department pair
        if (roleDepartmentPairs.length > 0) {
            await prisma.userRole.createMany({
                data: roleDepartmentPairs.map((pair: any) => ({
                    userId: user.id,
                    role: pair.role,
                    departmentId: pair.departmentId,
                })),
            });

            // Set the first UserRole as active
            const firstUserRole = await prisma.userRole.findFirst({
                where: {
                    userId: user.id,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            });

            if (firstUserRole) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { activeUserRoleId: firstUserRole.id },
                });
            }
        }

        const { password: _, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error) {
        console.error('Error creating user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
