import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess } from '@/lib/departments';

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const departmentId = params.id;
        const body = await request.json();
        const { reason } = body;

        // Only leaders and admins at or above this department level can close it
        const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
        
        const hasAccess = await hasDepartmentAccess(
            { role: session.user.role, departmentId: filterDepartmentId },
            departmentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to close this department' },
                { status: 403 }
            );
        }

        // Get the department with its children and user roles
        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true },
                    take: 1,
                },
            },
        });

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        if (!department.isActive) {
            return NextResponse.json({ error: 'Department is already closed' }, { status: 400 });
        }

        // Check for active child departments
        if (department.children.length > 0) {
            return NextResponse.json(
                { 
                    error: 'Cannot close department with active child departments',
                    childDepartments: department.children.map(c => c.name),
                },
                { status: 400 }
            );
        }

        // Get users who will lose access (users with roles in this department)
        const affectedUsers = department.userRoles.map(ur => ({
            id: ur.user.id,
            name: ur.user.name,
            email: ur.user.email,
            role: ur.role,
        }));

        // Start transaction to close department and remove user access
        await prisma.$transaction(async (tx) => {
            // 1. Remove all user roles for this department
            const userRolesToRemove = await tx.userRole.findMany({
                where: { departmentId },
            });

            for (const userRole of userRolesToRemove) {
                // Delete the user role
                await tx.userRole.delete({
                    where: { id: userRole.id },
                });

                // Check if this was the user's active role
                const user = await tx.user.findUnique({
                    where: { id: userRole.userId },
                    select: { activeUserRoleId: true },
                });

                if (user?.activeUserRoleId === userRole.id) {
                    // Find another role for this user
                    const remainingRole = await tx.userRole.findFirst({
                        where: { userId: userRole.userId },
                    });

                    if (remainingRole) {
                        // Set the next available role as active
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: remainingRole.id,
                                activeRole: remainingRole.role,
                                departmentId: remainingRole.departmentId,
                            },
                        });
                    } else {
                        // User has no more roles - clear their access
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: null,
                                activeRole: null,
                                departmentId: null,
                                roles: [],
                            },
                        });
                    }
                }

                // Update user's roles array to remove this role
                const userWithRoles = await tx.user.findUnique({
                    where: { id: userRole.userId },
                    select: { roles: true },
                });

                if (userWithRoles) {
                    const updatedRoles = userWithRoles.roles.filter(r => r !== userRole.role);
                    await tx.user.update({
                        where: { id: userRole.userId },
                        data: { roles: updatedRoles },
                    });
                }
            }

            // 2. Remove users from being directly assigned to this department
            await tx.user.updateMany({
                where: { departmentId },
                data: { departmentId: null },
            });

            // 3. Close the department (soft delete)
            await tx.department.update({
                where: { id: departmentId },
                data: {
                    isActive: false,
                    closedAt: new Date(),
                    closedBy: session.user.id,
                    closureReason: reason || null,
                },
            });

            // 4. Create audit log
            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    actionType: 'DELETE',
                    entityType: 'Department',
                    entityId: departmentId,
                    beforeData: {
                        name: department.name,
                        level: department.level,
                        isActive: true,
                        affectedUsers: affectedUsers,
                    },
                    afterData: {
                        name: department.name,
                        level: department.level,
                        isActive: false,
                        closedAt: new Date().toISOString(),
                        closureReason: reason,
                    },
                    description: `Closed department "${department.name}" (${department.level}). ${affectedUsers.length} user role(s) removed.`,
                    severity: 'HIGH',
                },
            });
        });

        return NextResponse.json({ 
            success: true,
            message: `Department "${department.name}" has been closed`,
            affectedUsers: affectedUsers.length,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to close department' },
            { status: 500 }
        );
    }
}

// GET endpoint to check if department can be closed (pre-validation)
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const departmentId = params.id;

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, level: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true, status: true },
                },
            },
        });

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        const canClose = department.isActive && department.children.length === 0;
        const warnings: string[] = [];
        const blockers: string[] = [];

        if (!department.isActive) {
            blockers.push('Department is already closed');
        }

        if (department.children.length > 0) {
            blockers.push(`Has ${department.children.length} active child department(s): ${department.children.map(c => c.name).join(', ')}`);
        }

        if (department.userRoles.length > 0) {
            warnings.push(`${department.userRoles.length} user(s) will lose access to this department`);
        }

        if (department.transactions.length > 0) {
            const pendingCount = department.transactions.filter(t => t.status === 'PENDING').length;
            warnings.push(`${department.transactions.length} transaction(s) are associated with this department (${pendingCount} pending)`);
            warnings.push('Transactions will be preserved for historical records');
        }

        return NextResponse.json({
            canClose,
            department: {
                id: department.id,
                name: department.name,
                level: department.level,
                isActive: department.isActive,
            },
            affectedUsers: department.userRoles.map(ur => ({
                id: ur.user.id,
                name: ur.user.name || ur.user.email,
                role: ur.role,
            })),
            childDepartments: department.children,
            transactionCount: department.transactions.length,
            warnings,
            blockers,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to check department' },
            { status: 500 }
        );
    }
}
