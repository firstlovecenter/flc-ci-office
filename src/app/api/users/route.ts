import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getDescendantDepartmentIds } from '@/lib/departments';

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
        const { name, email, password, role, departmentId } = body;

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
            
            // Verify the target department is within their scope
            if (departmentId && !allowedDepartmentIds.includes(departmentId)) {
                return new NextResponse('Forbidden - Cannot create user in this department', { status: 403 });
            }

            // Verify the role being assigned is appropriate for the admin's level
            // Admins can only assign roles at their level or below
            const userDept = departmentId ? await prisma.department.findUnique({ where: { id: departmentId } }) : null;
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

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: await bcrypt.hash(password, 10),
                role,
                departmentId: departmentId || null,
            },
        });

        const { password: _, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error) {
        console.error('Error creating user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
