import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { canManageUser, canAssignRole, ROLE_HIERARCHY } from '@/lib/roles';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { validateRoleAssignment } from '@/lib/roleValidation';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { title, name, email, roleDepartmentPairs, password } = body;
        const userId = params.id;

        // Check if user has admin role
        const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Admin role required' },
                { status: 403 }
            );
        }

        // Prevent users from editing themselves (should use profile page)
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'Use the profile page to edit your own details' },
                { status: 400 }
            );
        }

        // Get the user being edited
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Extract unique roles and departments for validation
        const userRoles: string[] | undefined = roleDepartmentPairs ? Array.from(new Set(roleDepartmentPairs.map((pair: any) => pair.role as string))) : undefined;
        const firstDept = roleDepartmentPairs?.[0]?.departmentId;

        // Validate role assignments if roles are being updated
        if (userRoles) {
            const validation = await validateRoleAssignment(userId, userRoles, firstDept, email);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
        }

        // Check if admin can manage this user based on role hierarchy
        // For users with multiple roles, check against their highest role
        const targetUserHighestRole = targetUser.roles?.[0] || 'COUNCIL_LEADER';
        if (!canManageUser(session.user.role, targetUserHighestRole)) {
            return NextResponse.json(
                { error: 'You cannot manage users with equal or higher roles' },
                { status: 403 }
            );
        }

        // For non-superadmins, verify department access
        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return NextResponse.json(
                    { error: 'No department assigned' },
                    { status: 403 }
                );
            }

            // Get all departments this admin oversees
            const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
            
            // Check current user's department
            if (targetUser.departmentId && !allowedDepartmentIds.includes(targetUser.departmentId)) {
                return NextResponse.json(
                    { error: 'Cannot manage users outside your department hierarchy' },
                    { status: 403 }
                );
            }

            // Check target departments (if being changed)
            if (roleDepartmentPairs) {
                for (const pair of roleDepartmentPairs) {
                    if (!allowedDepartmentIds.includes(pair.departmentId)) {
                        return NextResponse.json(
                            { error: 'Cannot assign user to a department outside your hierarchy' },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        // Check if admin can assign the new roles
        if (userRoles) {
            for (const role of userRoles) {
                if (!canAssignRole(session.user.role, role)) {
                    return NextResponse.json(
                        { error: `You cannot assign the role: ${role}` },
                        { status: 403 }
                    );
                }
            }
        }

        // Prepare update data
        const updateData: any = {
            title: title?.trim() || null,
            name,
            email,
        };

        // Update backward compatibility fields if role-department pairs are provided
        if (roleDepartmentPairs && roleDepartmentPairs.length > 0 && userRoles && userRoles.length > 0) {
            updateData.roles = userRoles;
            updateData.activeRole = userRoles[0];
            updateData.departmentId = firstDept;
        }

        // Only update password if provided
        if (password && password.trim()) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        // Update the user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                department: true,
            },
        });

        // Handle UserRole updates if role-department pairs are provided
        if (roleDepartmentPairs && roleDepartmentPairs.length > 0) {
            // Delete existing UserRole entries
            await prisma.userRole.deleteMany({
                where: { userId: userId },
            });

            // Create new UserRole entries
            await prisma.userRole.createMany({
                data: roleDepartmentPairs.map((pair: any) => ({
                    userId: userId,
                    role: pair.role,
                    departmentId: pair.departmentId,
                })),
            });

            // Set the first UserRole as active
            const firstUserRole = await prisma.userRole.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: 'asc' },
            });

            if (firstUserRole) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { activeUserRoleId: firstUserRole.id },
                });
            }
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;

        // Create audit log (skip for SUPERADMIN)
        if (session.user.role !== 'SUPERADMIN') {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    actionType: 'UPDATE',
                    entityType: 'User',
                    entityId: updatedUser.id,
                    afterData: { title, name, email, roleDepartmentPairs },
                },
            });
        }

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Error updating user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const userId = params.id;

        // Only SUPERADMIN can permanently delete users
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only SUPERADMIN can permanently delete users. Use archive instead.' },
                { status: 403 }
            );
        }

        // Prevent deleting yourself
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'You cannot delete your own account' },
                { status: 400 }
            );
        }

        // Get the user being deleted
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Delete the user permanently (SUPERADMIN only)
        await prisma.user.delete({
            where: { id: userId },
        });

        // SUPERADMIN deletions are not logged to audit log

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { archived } = body;
        const userId = params.id;

        // Check if user has admin role
        const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Admin role required' },
                { status: 403 }
            );
        }

        // Prevent archiving yourself
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'You cannot archive your own account' },
                { status: 400 }
            );
        }

        // Get the user being archived
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if admin can manage this user based on role hierarchy
        // User can be managed if admin can manage their highest role
        const targetHighestRole = targetUser.roles && targetUser.roles.length > 0 
            ? targetUser.roles.reduce((highest, role) => {
                const highestLevel = ROLE_HIERARCHY[highest] || 999;
                const roleLevel = ROLE_HIERARCHY[role] || 999;
                return roleLevel < highestLevel ? role : highest;
              }, targetUser.roles[0])
            : 'COUNCIL_LEADER';
            
        if (!canManageUser(session.user.role, targetHighestRole)) {
            return NextResponse.json(
                { error: 'You cannot archive users with equal or higher roles' },
                { status: 403 }
            );
        }

        // For non-superadmins, verify department access
        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return NextResponse.json(
                    { error: 'No department assigned' },
                    { status: 403 }
                );
            }

            // Get all departments this admin oversees
            const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
            
            // Check if user is in admin's department hierarchy
            if (targetUser.departmentId && !allowedDepartmentIds.includes(targetUser.departmentId)) {
                return NextResponse.json(
                    { error: 'Cannot archive users outside your department hierarchy' },
                    { status: 403 }
                );
            }
        }

        // Update archived status
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { archived },
            include: { department: true },
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;

        // Create audit log (skip for SUPERADMIN)
        if (session.user.role !== 'SUPERADMIN') {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    actionType: 'UPDATE',
                    entityType: 'User',
                    entityId: userId,
                    afterData: { archived },
                },
            });
        }

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Error archiving user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
