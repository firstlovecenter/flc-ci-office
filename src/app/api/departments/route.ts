import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

import { getDescendantDepartmentIds, canCreateDepartmentLevel, getLeaderRoleForLevel } from '@/lib/departments';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import crypto from 'crypto';

export const revalidate = 60; // Revalidate every 60 seconds

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
                // Non-superadmin users without department assignment return empty
                return NextResponse.json([]);
            }
        } else {
            // Regular fetch - exclude user's own department and siblings
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all departments
                whereClause = {};
            } else if (session.user.departmentId) {
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
        const { name, level, parentId, currencyId, leaderId } = body;

        // Validate required leader
        if (!leaderId) {
            return NextResponse.json(
                { error: 'A leader must be selected for the department' },
                { status: 400 }
            );
        }

        // Verify the leader exists
        const leader = await prisma.user.findUnique({
            where: { id: leaderId },
            include: { userRoles: true },
        });

        if (!leader) {
            return NextResponse.json(
                { error: 'Selected leader not found' },
                { status: 400 }
            );
        }

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

        // Create the department
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

        // Get the appropriate leader role for this department level
        const leaderRole = getLeaderRoleForLevel(level);

        // Create UserRole for the leader
        const userRole = await prisma.userRole.create({
            data: {
                userId: leaderId,
                role: leaderRole,
                departmentId: department.id,
            },
        });

        // Update the leader's departmentId and activeRole if this is their first role
        const isFirstRole = leader.userRoles.length === 0;
        await prisma.user.update({
            where: { id: leaderId },
            data: {
                departmentId: isFirstRole ? department.id : leader.departmentId,
                activeRole: isFirstRole ? leaderRole : leader.activeRole,
                activeUserRoleId: isFirstRole ? userRole.id : leader.activeUserRoleId,
                roles: isFirstRole ? [leaderRole] : { push: leaderRole },
            },
        });

        // Check if the leader needs a password reset (first time assignment)
        const needsPasswordSetup = !leader.password || leader.password === '';
        
        if (isFirstRole || needsPasswordSetup) {
            // Create a password reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await prisma.passwordReset.create({
                data: {
                    userId: leaderId,
                    token: resetToken,
                    expiresAt: resetTokenExpiry,
                },
            });

            // Send SMS with password setup link
            const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
            const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
            
            const smsMessage = `Welcome to FLC Accounts! You have been assigned as ${leaderRole.replace('_', ' ')} for ${name}. Please set up your password: ${resetLink}`;
            
            try {
                await sendSms({
                    to: formatGhanaPhone(leader.phone),
                    message: smsMessage,
                });
            } catch (smsError) {
                console.error('Failed to send SMS to leader:', smsError);
                // Don't fail the request if SMS fails
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Department',
                entityId: department.id,
                afterData: { name, level, parentId, currencyId, leaderId, leaderRole },
                description: `Created department ${name} with ${leader.name || leader.email} as ${leaderRole}`,
            },
        });

        return NextResponse.json(department);
    } catch (error) {
        console.error('Failed to create department:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
