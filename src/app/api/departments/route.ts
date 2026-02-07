import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DepartmentLevel } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

import { getDescendantDepartmentIds, canCreateDepartmentLevel, getLeaderRoleForLevel, getAdminRoleForLevel } from '@/lib/departments';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateFirstRoleAssignmentSms } from '@/lib/sms-templates';
import crypto from 'crypto';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const fetchAll = searchParams.get('all') === 'true';
        const includeClosed = searchParams.get('includeClosed') === 'true';

        let whereClause: any = {};

        // By default, exclude closed departments unless specifically requested
        if (!includeClosed) {
            whereClause.isActive = true;
        }

        // Determine which department to use for filtering
        // For users with multiple roles, use the activeUserRole's department
        // For users with single roles, use their session department
        let filterDepartmentId = session.user.departmentId;
        
        if (session.user.activeUserRole?.departmentId) {
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        // If fetching all departments (for dropdowns), return based on role
        if (fetchAll) {
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all departments (whereClause already has isActive filter)
            } else if (filterDepartmentId) {
                // Others see their department and descendants
                const allowedIds = await getDescendantDepartmentIds(filterDepartmentId);
                whereClause.id = { in: allowedIds };
            } else {
                // Non-superadmin users without department assignment return empty
                return NextResponse.json([]);
            }
        } else {
            // Regular fetch - exclude user's own department and siblings
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all departments (whereClause already has isActive filter)
            } else if (filterDepartmentId) {
                const allowedIds = await getDescendantDepartmentIds(filterDepartmentId);
                
                // Remove the user's own department from the list
                const filteredIds = allowedIds.filter(id => id !== filterDepartmentId);
                
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
                children: {
                    where: includeClosed ? {} : { isActive: true },
                },
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
                        transactions: true,
                    },
                },
            },
        });

        // For non-superadmin users, exclude their own department and sibling departments
        let filteredDepartments = departments;
        if (session.user.role !== 'SUPERADMIN' && !fetchAll) {
            const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
            if (filterDepartmentId) {
                filteredDepartments = departments.filter(dept => dept.id !== filterDepartmentId);
            }
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
        const { name, level, parentId, currencyId, leaderId, adminId } = body;

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

        // Verify the admin exists if provided
        let admin = null;
        if (adminId) {
            admin = await prisma.user.findUnique({
                where: { id: adminId },
                include: { userRoles: true },
            });

            if (!admin) {
                return NextResponse.json(
                    { error: 'Selected admin not found' },
                    { status: 400 }
                );
            }

            // Ensure admin is different from leader
            if (adminId === leaderId) {
                return NextResponse.json(
                    { error: 'Admin must be different from leader' },
                    { status: 400 }
                );
            }
        }

        // Get user's department to check level
        const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
        let userDepartmentLevel: DepartmentLevel | undefined;
        if (filterDepartmentId) {
            const userDepartment = await prisma.department.findUnique({
                where: { id: filterDepartmentId },
                select: { level: true },
            });
            userDepartmentLevel = userDepartment?.level ?? undefined;
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
            const allowedIds = filterDepartmentId 
                ? await getDescendantDepartmentIds(filterDepartmentId)
                : [];
            
            if (!allowedIds.includes(parentId)) {
                return NextResponse.json(
                    { error: 'You do not have access to the selected parent department' },
                    { status: 403 }
                );
            }
        }

        // Validate currency for OVERSIGHT departments
        if (level === 'OVERSIGHT' && !currencyId) {
            return NextResponse.json(
                { error: 'Currency is required for OVERSIGHT departments' },
                { status: 400 }
            );
        }

        // Create the department
        const department = await prisma.department.create({
            data: {
                id: crypto.randomUUID(),
                name,
                level,
                parentId,
                updatedAt: new Date(),
            },
        });

        // Create DepartmentBaseCurrency for OVERSIGHT departments
        if (level === 'OVERSIGHT' && currencyId) {
            await prisma.departmentBaseCurrency.create({
                data: {
                    id: crypto.randomUUID(),
                    departmentId: department.id,
                    currencyId: currencyId,
                    setBy: session.user.id,
                    updatedAt: new Date(),
                },
            });
        }

        // Get the appropriate leader role for this department level
        const leaderRole = getLeaderRoleForLevel(level);

        // Create UserRole for the leader
        const userRole = await prisma.userRole.create({
            data: {
                id: crypto.randomUUID(),
                userId: leaderId,
                role: leaderRole,
                departmentId: department.id,
                updatedAt: new Date(),
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
                updatedAt: new Date(),
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
                    id: crypto.randomUUID(),
                    userId: leaderId,
                    token: resetToken,
                    expiresAt: resetTokenExpiry,
                },
            });

            // Send SMS with password setup link
            const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
            const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
            
            const smsMessage = await generateFirstRoleAssignmentSms({
                userName: leader.name || 'User',
                role: leaderRole,
                department: name,
                resetLink,
            });
            
            try {
                await sendSms({
                    to: formatGhanaPhone(leader.phone),
                    message: smsMessage,
                });
            } catch (smsError) {
                // Don't fail the request if SMS fails
            }
        }

        // Handle admin assignment if provided
        let adminRole = null;
        if (adminId && admin) {
            adminRole = getAdminRoleForLevel(level);
            
            if (adminRole) {
                // Create UserRole for the admin
                const adminUserRole = await prisma.userRole.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: adminId,
                        role: adminRole,
                        departmentId: department.id,
                        updatedAt: new Date(),
                    },
                });

                // Update the admin's user record
                const isAdminFirstRole = admin.userRoles.length === 0;
                await prisma.user.update({
                    where: { id: adminId },
                    data: {
                        departmentId: isAdminFirstRole ? department.id : admin.departmentId,
                        activeRole: isAdminFirstRole ? adminRole : admin.activeRole,
                        activeUserRoleId: isAdminFirstRole ? adminUserRole.id : admin.activeUserRoleId,
                        updatedAt: new Date(),
                    },
                });

                // Send SMS to admin if they need password setup
                const adminNeedsPasswordSetup = !admin.password || admin.password === '';
                
                if (isAdminFirstRole || adminNeedsPasswordSetup) {
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
                        userName: admin.name || 'User',
                        role: adminRole,
                        department: name,
                        resetLink,
                    });
                    
                    try {
                        await sendSms({
                            to: formatGhanaPhone(admin.phone),
                            message: smsMessage,
                        });
                    } catch (smsError) {
                    }
                }
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Department',
                entityId: department.id,
                afterData: { name, level, parentId, currencyId, leaderId, leaderRole, adminId, adminRole },
                description: `Created department ${name} with ${leader.name || leader.email} as ${leaderRole}${admin ? ` and ${admin.name || admin.email} as ${adminRole}` : ''}`,
            },
        });

        return NextResponse.json(department);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
