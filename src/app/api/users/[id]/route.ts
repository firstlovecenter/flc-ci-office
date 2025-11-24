import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateFirstRoleAssignmentSms } from '@/lib/sms-templates';
import { canManageUser, canAssignRole, ROLE_HIERARCHY } from '@/lib/roles';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { validateRoleAssignment } from '@/lib/roleValidation';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { title, name, email, phone, roleDepartmentPairs } = body;
        const userId = params.id;

        // Validate required fields
        if (!phone?.trim()) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

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
            email: email ? email.toLowerCase() : undefined,
        };

        // Phone number update restriction: only user themselves, SUPERADMIN, or GLOBAL_ADMIN
        if (phone !== undefined && phone?.trim() !== targetUser.phone) {
            const canUpdatePhone = 
                userId === session.user.id || // User updating their own phone
                session.user.role === 'SUPERADMIN' || 
                session.user.role === 'GLOBAL_ADMIN';
            
            if (!canUpdatePhone) {
                return NextResponse.json(
                    { error: 'You have no access to do this.' },
                    { status: 403 }
                );
            }
            
            updateData.phone = phone.trim();
        }

        // Validate phone number if being updated
        if (updateData.phone && !updateData.phone.trim()) {
            return NextResponse.json(
                { error: 'Phone number cannot be empty' },
                { status: 400 }
            );
        }

        // Update backward compatibility fields if role-department pairs are provided
        if (roleDepartmentPairs && roleDepartmentPairs.length > 0 && userRoles && userRoles.length > 0) {
            updateData.roles = userRoles;
            updateData.activeRole = userRoles[0];
            updateData.departmentId = firstDept;
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
        if (roleDepartmentPairs !== undefined) {
            // Get existing roles to determine if this is first assignment or removal
            const existingUserRoles = await prisma.userRole.findMany({
                where: { userId: userId },
            });
            const hadRolesBefore = existingUserRoles.length > 0;
            const hasRolesNow = roleDepartmentPairs.length > 0;
            
            // First role assignment: never had roles before AND getting roles now
            const isFirstRoleAssignment = !hadRolesBefore && hasRolesNow;
            
            // Re-assignment: had roles, then removed (0 roles), now getting roles again
            const isReassignmentAfterRemoval = hadRolesBefore && hasRolesNow;

            // Delete existing UserRole entries
            await prisma.userRole.deleteMany({
                where: { userId: userId },
            });

            if (hasRolesNow) {
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
            } else {
                // All roles removed - revoke access by invalidating password
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        password: null, // Revoke login access
                        activeUserRoleId: null,
                        activeRole: null,
                        departmentId: null,
                    },
                });
                
                // Invalidate any password reset tokens
                await prisma.passwordReset.updateMany({
                    where: {
                        userId: userId,
                        used: false,
                    },
                    data: {
                        used: true,
                        usedAt: new Date(),
                    },
                });
            }

            // Send SMS notification for first role assignment OR re-assignment after removal (password creation)
            const phoneNumber = updateData.phone || targetUser?.phone;
            const needsPasswordCreation = isFirstRoleAssignment || (isReassignmentAfterRemoval && !targetUser.password);
            
            if (phoneNumber && hasRolesNow && needsPasswordCreation) {
                try {
                    // First role assignment: Send password creation SMS
                    const resetToken = crypto.randomBytes(32).toString('hex');
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

                    // Invalidate any existing password reset tokens
                    await prisma.passwordReset.updateMany({
                        where: {
                            userId: userId,
                            used: false,
                        },
                        data: {
                            used: true,
                            usedAt: new Date(),
                        },
                    });

                    // Create new password reset record
                    await prisma.passwordReset.create({
                        data: {
                            token: resetToken,
                            userId: userId,
                            expiresAt,
                        },
                    });

                    const resetCode = resetToken.substring(0, 6).toUpperCase();
                    const primaryRolePair = roleDepartmentPairs[0];
                    const department = await prisma.department.findUnique({
                        where: { id: primaryRolePair.departmentId },
                        select: { name: true },
                    });

                    const formattedPhone = formatGhanaPhone(phoneNumber);
                    const smsContent = generateFirstRoleAssignmentSms({
                        userName: name || email || 'User',
                        role: primaryRolePair.role,
                        department: department?.name || 'Unknown Department',
                        resetCode,
                    });

                    const smsSent = await sendSms({
                        to: formattedPhone,
                        message: smsContent,
                    });
                } catch (notificationError) {
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
        return NextResponse.json(
            { error: 'Failed to update user. Please try again.' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        return NextResponse.json(
            { error: 'Failed to delete user. Please try again.' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        return NextResponse.json(
            { error: 'Failed to archive user. Please try again.' },
            { status: 500 }
        );
    }
}
