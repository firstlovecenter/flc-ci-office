import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

import { getDescendantDepartmentIds, canCreateDepartmentLevel } from '@/lib/departments';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const fetchAll = searchParams.get('all') === 'true';

        let whereClause: any = {};

        // If fetching all departments (for dropdowns), return based on role
        if (fetchAll) {
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all departments
                whereClause = {};
            } else if (session.user.departmentId) {
                // Others see their department and descendants
                const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);
                whereClause.id = { in: allowedIds };
            } else {
                return NextResponse.json([]);
            }
        } else {
            // Regular fetch - exclude user's own department and siblings
            if (session.user.role !== 'SUPERADMIN') {
                if (session.user.departmentId) {
                    const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);
                    
                    // Remove the user's own department from the list
                    const filteredIds = allowedIds.filter(id => id !== session.user.departmentId);
                    
                    if (filteredIds.length === 0) {
                        // User has no child departments
                        return NextResponse.json([]);
                    }
                    
                    whereClause.id = { in: filteredIds };
                } else {
                    // User has no department assigned, so they can't see any departments
                    return NextResponse.json([]);
                }
            }
        }

        const departments = await prisma.department.findMany({
            where: whereClause,
            include: {
                parent: true,
                children: true,
                userRoles: {
                    where: {
                        OR: [
                            { role: 'COUNCIL_LEADER' },
                            { role: 'STREAM_LEADER' },
                            { role: 'CAMPUS_LEADER' },
                            { role: 'REGIONAL_LEADER' },
                            { role: 'NATIONAL_LEADER' },
                            { role: 'INTERNATIONAL_LEADER' },
                            { role: 'GLOBAL_LEADER' },
                        ],
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    take: 1,
                },
            },
        });

        // For non-superadmin users, exclude their own department and sibling departments
        let filteredDepartments = departments;
        if (session.user.role !== 'SUPERADMIN' && !fetchAll && session.user.departmentId) {
            filteredDepartments = departments.filter(dept => dept.id !== session.user.departmentId);
        }

        return NextResponse.json(filteredDepartments);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, level, parentId, currencyId } = body;

        // Get user's department to check level
        let userDepartmentLevel;
        if (session.user.departmentId) {
            const userDepartment = await prisma.department.findUnique({
                where: { id: session.user.departmentId },
                select: { level: true },
            });
            userDepartmentLevel = userDepartment?.level;
        }

        // Check if user has permission to create this level of department
        const canCreate = canCreateDepartmentLevel(session.user.role, userDepartmentLevel, level);
        
        if (!canCreate) {
            return NextResponse.json(
                { error: 'You do not have permission to create departments at this level' },
                { status: 403 }
            );
        }

        // If parentId is provided, verify user has access to that department
        if (parentId && session.user.role !== 'SUPERADMIN') {
            const allowedIds = session.user.departmentId 
                ? await getDescendantDepartmentIds(session.user.departmentId)
                : [];
            
            if (!allowedIds.includes(parentId)) {
                return NextResponse.json(
                    { error: 'You do not have access to the selected parent department' },
                    { status: 403 }
                );
            }
        }

        // Validate currency for NATIONAL departments
        if (level === 'NATIONAL' && !currencyId) {
            return NextResponse.json(
                { error: 'Currency is required for NATIONAL departments' },
                { status: 400 }
            );
        }

        const department = await prisma.department.create({
            data: {
                name,
                level,
                parentId,
            },
        });

        // Create DepartmentBaseCurrency for NATIONAL departments
        if (level === 'NATIONAL' && currencyId) {
            await prisma.departmentBaseCurrency.create({
                data: {
                    departmentId: department.id,
                    currencyId: currencyId,
                    setBy: session.user.id,
                },
            });
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Department',
                entityId: department.id,
                afterData: { name, level, parentId, currencyId },
            },
        });

        return NextResponse.json(department);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
