import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess, getLeaderRoleForLevel } from '@/lib/departments';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import crypto from 'crypto';

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
                parent: true,
            },
        });

        if (!department) {
            return new NextResponse('Department not found', { status: 404 });
        }

        return NextResponse.json(department);
    } catch (error) {
        console.error('Error fetching department:', error);
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
        const { name, level, parentId, currencyId, leaderId } = body;
        const departmentId = params.id;

        // Check if user has access to this department
        const hasAccess = await hasDepartmentAccess(
            { role: session.user.role, departmentId: session.user.departmentId },
            departmentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this department' },
                { status: 403 }
            );
        }

        // Get current department with its leader
        const currentDepartment = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                userRoles: {
                    where: {
                        role: {
                            in: ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 
                                 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER']
                        }
                    },
                    include: { user: true },
                    take: 1,
                },
            },
        });

        if (!currentDepartment) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        // Validate currency for NATIONAL departments
        if (level === 'NATIONAL' && !currencyId) {
            return NextResponse.json(
                { error: 'Currency is required for NATIONAL departments' },
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

        // Update or create DepartmentBaseCurrency for NATIONAL departments
        if (level === 'NATIONAL' && currencyId) {
            await prisma.departmentBaseCurrency.upsert({
                where: { departmentId },
                update: {
                    currencyId,
                    setBy: session.user.id,
                },
                create: {
                    departmentId,
                    currencyId,
                    setBy: session.user.id,
                },
            });
        }

        // Handle leader change if leaderId is provided
        if (leaderId) {
            const currentLeaderRole = currentDepartment.userRoles[0];
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
                                roles: [],
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
                        userId: leaderId,
                        role: leaderRole,
                        departmentId: departmentId,
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
                        roles: isFirstRole ? [leaderRole] : { push: leaderRole },
                    },
                });

                // Send SMS to new leader if they need password setup
                const needsPasswordSetup = !newLeader.password || newLeader.password === '';
                
                if (isFirstRole || needsPasswordSetup) {
                    const resetToken = crypto.randomBytes(32).toString('hex');
                    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                    await prisma.passwordReset.create({
                        data: {
                            userId: leaderId,
                            token: resetToken,
                            expiresAt: resetTokenExpiry,
                        },
                    });

                    const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
                    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
                    
                    const smsMessage = `Welcome to FLC Accounts! You have been assigned as ${leaderRole.replace('_', ' ')} for ${name}. Please set up your password: ${resetLink}`;
                    
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

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Department',
                entityId: updatedDepartment.id,
                afterData: JSON.parse(JSON.stringify({ ...updatedDepartment, currencyId })),
            },
        });

        return NextResponse.json(updatedDepartment);
    } catch (error) {
        console.error('Failed to update department:', error);
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

        // Delete the department
        await prisma.department.delete({
            where: { id: departmentId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
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
