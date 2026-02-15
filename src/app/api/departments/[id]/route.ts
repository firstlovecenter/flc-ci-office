import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess, getLeaderRoleForLevel, getAdminRoleForLevel } from '@/lib/departments';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateFirstRoleAssignmentSms } from '@/lib/sms-templates';
import crypto from 'crypto';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

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

        // Verify department access for non-superadmins
        if (session.user.role !== 'SUPERADMIN') {
            const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
            const hasAccess = await hasDepartmentAccess(
                { role: session.user.role, departmentId: filterDepartmentId },
                departmentId
            );
            if (!hasAccess) {
                return new NextResponse('Forbidden', { status: 403 });
            }
        }

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                parent: true,
                userRoles: {
                    where: {
                        OR: [
                            { role: 'COUNCIL_LEADER' },
                            { role: 'STREAM_LEADER' },
                            { role: 'CAMPUS_LEADER' },
                            { role: 'OVERSIGHT_LEADER' },
                            { role: 'DENOMINATION_LEADER' },
                            { role: 'CAMPUS_ADMIN' },
                            { role: 'OVERSIGHT_ADMIN' },
                            { role: 'DENOMINATION_ADMIN' },
                        ],
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                image: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        children: true,
                        userRoles: true,
                    },
                },
            },
        });

        if (!department) {
            return new NextResponse('Department not found', { status: 404 });
        }

        return NextResponse.json(department);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

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
        const { name, level, parentId, currencyId, leaderId, adminId } = body;
        const departmentId = params.id;

        // Check if user has access to this department
        const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
        
        const hasAccess = await hasDepartmentAccess(
            { role: session.user.role, departmentId: filterDepartmentId },
            departmentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this department' },
                { status: 403 }
            );
        }

        // Get current department with its leader and admin
        const currentDepartment = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                userRoles: {
                    where: {
                        role: {
                            in: ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 
                                 'STREAM_LEADER', 'COUNCIL_LEADER',
                                 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN',
                                 'CAMPUS_ADMIN']
                        }
                    },
                    include: { user: true },
                },
            },
        });

        if (!currentDepartment) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        // Separate leader and admin roles
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 
                            'STREAM_LEADER', 'COUNCIL_LEADER'];
        const adminRoles = ['DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN',
                           'CAMPUS_ADMIN'];
        
        const currentLeaderRole = currentDepartment.userRoles.find(
            (ur) => ur.role && leaderRoles.includes(ur.role)
        );
        const currentAdminRole = currentDepartment.userRoles.find(
            (ur) => ur.role && adminRoles.includes(ur.role)
        );

        // Validate currency for OVERSIGHT departments
        if (level === 'OVERSIGHT' && !currencyId) {
            return NextResponse.json(
                { error: 'Currency is required for OVERSIGHT departments' },
                { status: 400 }
            );
        }

        // Update the department
        const updatedDepartment = await prisma.department.update({
            where: { id: departmentId },
            data: {
                name,
                level,
                parentId: parentId || null,
            },
        });

        // Update or create DepartmentBaseCurrency for OVERSIGHT departments
        if (level === 'OVERSIGHT' && currencyId) {
            await prisma.departmentBaseCurrency.upsert({
                where: { departmentId },
                update: {
                    currencyId,
                    setBy: session.user.id,
                    updatedAt: new Date(),
                },
                create: {
                    id: crypto.randomUUID(),
                    departmentId,
                    currencyId,
                    setBy: session.user.id,
                    updatedAt: new Date(),
                },
            });
        }

        // If level changed, update existing leader and admin roles to match new level
        if (level !== currentDepartment.level) {
            const newLeaderRole = getLeaderRoleForLevel(level);
            const newAdminRole = getAdminRoleForLevel(level);

            // Update existing leader's role if they exist
            if (currentLeaderRole) {
                await prisma.userRole.update({
                    where: { id: currentLeaderRole.id },
                    data: { role: newLeaderRole },
                });

                // Update the user's activeRole if this is their active role
                const leaderUser = await prisma.user.findUnique({
                    where: { id: currentLeaderRole.userId },
                });
                if (leaderUser?.activeUserRoleId === currentLeaderRole.id) {
                    await prisma.user.update({
                        where: { id: currentLeaderRole.userId },
                        data: { activeRole: newLeaderRole },
                    });
                }
            }

            // Update existing admin's role if they exist and new level has admin role
            if (currentAdminRole && newAdminRole) {
                await prisma.userRole.update({
                    where: { id: currentAdminRole.id },
                    data: { role: newAdminRole },
                });

                // Update the user's activeRole if this is their active role
                const adminUser = await prisma.user.findUnique({
                    where: { id: currentAdminRole.userId },
                });
                if (adminUser?.activeUserRoleId === currentAdminRole.id) {
                    await prisma.user.update({
                        where: { id: currentAdminRole.userId },
                        data: { activeRole: newAdminRole },
                    });
                }
            }
        }

        // Handle leader change if leaderId is provided
        if (leaderId) {
            const currentLeaderId = currentLeaderRole?.userId;
            
            // Only process if leader is changing
            if (currentLeaderId !== leaderId) {
                const leaderRole = getLeaderRoleForLevel(level);
                
                // Remove old leader's role for this department
                if (currentLeaderRole) {
                    await prisma.userRole.delete({
                        where: { id: currentLeaderRole.id },
                    });

                    // Check if old leader has any other roles
                    const oldLeaderRemainingRoles = await prisma.userRole.findMany({
                        where: { userId: currentLeaderId },
                    });

                    if (oldLeaderRemainingRoles.length === 0) {
                        // Old leader has no more roles - clear their access
                        await prisma.user.update({
                            where: { id: currentLeaderId },
                            data: {
                                activeUserRoleId: null,
                                activeRole: null,
                                departmentId: null,
                            },
                        });
                    } else {
                        // Set the first remaining role as active
                        const newActiveRole = oldLeaderRemainingRoles[0];
                        await prisma.user.update({
                            where: { id: currentLeaderId },
                            data: {
                                activeUserRoleId: newActiveRole.id,
                                activeRole: newActiveRole.role,
                                departmentId: newActiveRole.departmentId,
                            },
                        });
                    }
                }

                // Get new leader info
                const newLeader = await prisma.user.findUnique({
                    where: { id: leaderId },
                    include: { userRoles: true },
                });

                if (!newLeader) {
                    return NextResponse.json({ error: 'New leader not found' }, { status: 400 });
                }

                // Create new leader's role
                const newUserRole = await prisma.userRole.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: leaderId,
                        role: leaderRole,
                        departmentId: departmentId,
                        updatedAt: new Date(),
                    },
                });

                // Update new leader's user record
                const isFirstRole = newLeader.userRoles.length === 0;
                await prisma.user.update({
                    where: { id: leaderId },
                    data: {
                        departmentId: isFirstRole ? departmentId : newLeader.departmentId,
                        activeRole: isFirstRole ? leaderRole : newLeader.activeRole,
                        activeUserRoleId: isFirstRole ? newUserRole.id : newLeader.activeUserRoleId,
                        updatedAt: new Date(),
                    },
                });

                // Send SMS to new leader if they need password setup
                const needsPasswordSetup = !newLeader.password || newLeader.password === '';
                
                if (isFirstRole || needsPasswordSetup) {
                    const resetToken = crypto.randomBytes(32).toString('hex');
                    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                    await prisma.passwordReset.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: leaderId,
                            token: resetToken,
                            expiresAt: resetTokenExpiry,
                        },
                    });

                    const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
                    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
                    
                    const smsMessage = await generateFirstRoleAssignmentSms({
                        userName: newLeader.name || 'User',
                        role: leaderRole,
                        department: name,
                        resetLink,
                    });
                    
                    try {
                        await sendSms({
                            to: formatGhanaPhone(newLeader.phone),
                            message: smsMessage,
                        });
                    } catch (smsError) {
                        console.error('Failed to send SMS to new leader:', smsError);
                    }
                }

                // Audit the leader change
                await prisma.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        actionType: 'UPDATE',
                        entityType: 'Department',
                        entityId: departmentId,
                        beforeData: { leaderId: currentLeaderId, leaderName: currentLeaderRole?.user?.name },
                        afterData: { leaderId, leaderName: newLeader.name, leaderRole },
                        description: `Changed leader of ${name} from ${currentLeaderRole?.user?.name || 'none'} to ${newLeader.name}`,
                    },
                });
            }
        }

        // Handle admin change if adminId is provided
        const adminRole = getAdminRoleForLevel(level);
        if (adminRole && adminId !== undefined) {
            const currentAdminId = currentAdminRole?.userId;
            
            // Only process if admin is changing
            if (currentAdminId !== adminId) {
                // Remove old admin's role for this department
                if (currentAdminRole) {
                    await prisma.userRole.delete({
                        where: { id: currentAdminRole.id },
                    });

                    // Check if old admin has any other roles
                    const oldAdminRemainingRoles = await prisma.userRole.findMany({
                        where: { userId: currentAdminId },
                    });

                    if (oldAdminRemainingRoles.length === 0) {
                        // Old admin has no more roles - clear their access
                        await prisma.user.update({
                            where: { id: currentAdminId },
                            data: {
                                activeUserRoleId: null,
                                activeRole: null,
                                departmentId: null,
                                updatedAt: new Date(),
                            },
                        });
                    } else {
                        // Set the first remaining role as active
                        const newActiveRole = oldAdminRemainingRoles[0];
                        await prisma.user.update({
                            where: { id: currentAdminId },
                            data: {
                                activeUserRoleId: newActiveRole.id,
                                activeRole: newActiveRole.role,
                                departmentId: newActiveRole.departmentId,
                            },
                        });
                    }
                }

                // If a new admin is assigned
                if (adminId) {
                    // Get new admin info
                    const newAdmin = await prisma.user.findUnique({
                        where: { id: adminId },
                        include: { userRoles: true },
                    });

                    if (!newAdmin) {
                        return NextResponse.json({ error: 'New admin not found' }, { status: 400 });
                    }

                    // Create new admin's role
                    const newUserRole = await prisma.userRole.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: adminId,
                            role: adminRole,
                            departmentId: departmentId,
                            updatedAt: new Date(),
                        },
                    });

                    // Update new admin's user record
                    const isFirstRole = newAdmin.userRoles.length === 0;
                    await prisma.user.update({
                        where: { id: adminId },
                        data: {
                            departmentId: isFirstRole ? departmentId : newAdmin.departmentId,
                            activeRole: isFirstRole ? adminRole : newAdmin.activeRole,
                            activeUserRoleId: isFirstRole ? newUserRole.id : newAdmin.activeUserRoleId,
                            updatedAt: new Date(),
                        },
                    });

                    // Send SMS to new admin if they need password setup
                    const needsPasswordSetup = !newAdmin.password || newAdmin.password === '';
                    
                    if (isFirstRole || needsPasswordSetup) {
                        const resetToken = crypto.randomBytes(32).toString('hex');
                        const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                        await prisma.passwordReset.create({
                            data: {
                                id: crypto.randomUUID(),
                                userId: adminId,
                                token: resetToken,
                                expiresAt: resetTokenExpiry,
                            },
                        });

                        const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
                        const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
                        
                        const smsMessage = await generateFirstRoleAssignmentSms({
                            userName: newAdmin.name || 'User',
                            role: adminRole,
                            department: name,
                            resetLink,
                        });
                        
                        try {
                            await sendSms({
                                to: formatGhanaPhone(newAdmin.phone),
                                message: smsMessage,
                            });
                        } catch (smsError) {
                            console.error('Failed to send SMS to new admin:', smsError);
                        }
                    }

                    // Audit the admin change
                    await prisma.auditLog.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: session.user.id,
                            actionType: 'UPDATE',
                            entityType: 'Department',
                            entityId: departmentId,
                            beforeData: { adminId: currentAdminId, adminName: currentAdminRole?.user?.name },
                            afterData: { adminId, adminName: newAdmin.name, adminRole },
                            description: `Changed admin of ${name} from ${currentAdminRole?.user?.name || 'none'} to ${newAdmin.name}`,
                        },
                    });
                } else if (currentAdminRole) {
                    // Admin was removed but not replaced
                    await prisma.auditLog.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: session.user.id,
                            actionType: 'UPDATE',
                            entityType: 'Department',
                            entityId: departmentId,
                            beforeData: { adminId: currentAdminId, adminName: currentAdminRole?.user?.name },
                            afterData: { adminId: null, adminName: null },
                            description: `Removed admin ${currentAdminRole?.user?.name} from ${name}`,
                        },
                    });
                }
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Department',
                entityId: updatedDepartment.id,
                afterData: JSON.parse(JSON.stringify({ ...updatedDepartment, currencyId })),
            },
        });

        return NextResponse.json(updatedDepartment);
    } catch (error) {
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
        const departmentId = params.id;

        // Only superadmin can delete departments
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only superadmin can delete departments' },
                { status: 403 }
            );
        }

        // Check if department has children
        const children = await prisma.department.findMany({
            where: { parentId: departmentId },
        });

        if (children.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete department with child departments' },
                { status: 400 }
            );
        }

        // Check if department has users
        const users = await prisma.user.findMany({
            where: { departmentId },
        });

        if (users.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete department with assigned users' },
                { status: 400 }
            );
        }

        // Get the department to check its level
        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { level: true },
        });

        // If it's an OVERSIGHT level department, delete its base currency first
        if (department?.level === 'OVERSIGHT') {
            await prisma.departmentBaseCurrency.deleteMany({
                where: { departmentId },
            });
        }

        // Delete the department
        await prisma.department.delete({
            where: { id: departmentId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Department',
                entityId: departmentId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
