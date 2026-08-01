import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrganisationLevel } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

import { getDescendantOrganisationIds, canCreateOrganisationLevel, canCreateAccount, getLeaderRoleForLevel, getAdminRoleForLevel } from '@/lib/organisations';
import { validateParentChild, validateAccountTypeForLevel } from '@/lib/org-model';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateFirstRoleAssignmentSms } from '@/lib/sms-templates';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generateFirstRoleAssignmentEmail } from '@/lib/email-templates';
import crypto from 'crypto';
import type { AccountType } from '@prisma/client';

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

        // By default, exclude closed organisations unless specifically requested
        if (!includeClosed) {
            whereClause.isActive = true;
        }

        // Determine which organisation to use for filtering
        // For users with multiple roles, use the activeUserRole's organisation
        // For users with single roles, use their session organisation
        let filterOrganisationId = session.user.organisationId;
        
        if (session.user.activeUserRole?.organisationId) {
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        // If fetching all organisations (for dropdowns), return based on role
        if (fetchAll) {
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all organisations (whereClause already has isActive filter)
            } else if (filterOrganisationId) {
                // Others see their organisation and descendants. Closed rows are
                // pruned from the active walk, so asking for them means walking
                // the inactive tree too — otherwise `includeClosed` returns
                // nothing extra for anyone but a superadmin.
                const allowedIds = await getDescendantOrganisationIds(filterOrganisationId, includeClosed);
                whereClause.id = { in: allowedIds };
            } else {
                // Non-superadmin users without organisation assignment return empty
                return NextResponse.json([]);
            }
        } else {
            // Regular fetch - exclude user's own organisation and siblings
            if (session.user.role === 'SUPERADMIN') {
                // Superadmin can see all organisations (whereClause already has isActive filter)
            } else if (filterOrganisationId) {
                const allowedIds = await getDescendantOrganisationIds(filterOrganisationId, includeClosed);

                // Remove the user's own organisation from the list
                const filteredIds = allowedIds.filter(id => id !== filterOrganisationId);
                
                if (filteredIds.length === 0) {
                    // User has no child organisations
                    return NextResponse.json([]);
                }
                
                whereClause.id = { in: filteredIds };
            } else {
                // User has no organisation assigned, so they can't see any organisations
                return NextResponse.json([]);
            }
        }

        const organisations = await prisma.organisation.findMany({
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

        // For non-superadmin users, exclude their own organisation and sibling organisations
        let filteredOrganisations = organisations;
        if (session.user.role !== 'SUPERADMIN' && !fetchAll) {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            if (filterOrganisationId) {
                filteredOrganisations = organisations.filter(dept => dept.id !== filterOrganisationId);
            }
        }

        return NextResponse.json(filteredOrganisations);
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
        const { name, level, parentId, leaderId, adminId, accountType } = body;

        if (!level) {
            return NextResponse.json({ error: 'Church level is required' }, { status: 400 });
        }

        // Validate required leader
        if (!leaderId) {
            return NextResponse.json(
                { error: 'A leader must be selected for the church' },
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

        // Get user's organisation to check level
        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        let userOrganisationLevel: OrganisationLevel | undefined;
        if (filterOrganisationId) {
            const userOrganisation = await prisma.organisation.findUnique({
                where: { id: filterOrganisationId },
                select: { level: true },
            });
            userOrganisationLevel = userOrganisation?.level ?? undefined;
        }

        // Check if user has permission to create this entity
        const canCreate = level === 'COUNCIL'
            ? canCreateAccount(session.user.role, userOrganisationLevel)
            : canCreateOrganisationLevel(session.user.role, userOrganisationLevel, level);
        
        if (!canCreate) {
            return NextResponse.json(
                { error: level === 'COUNCIL'
                    ? 'You do not have permission to open accounts'
                    : 'You do not have permission to create churches at this level' },
                { status: 403 }
            );
        }

        // If parentId is provided, verify user has access to that organisation
        if (parentId && session.user.role !== 'SUPERADMIN') {
            const allowedIds = filterOrganisationId 
                ? await getDescendantOrganisationIds(filterOrganisationId)
                : [];
            
            if (!allowedIds.includes(parentId)) {
                return NextResponse.json(
                    { error: 'You do not have access to the selected parent church' },
                    { status: 403 }
                );
            }
        }

        // Accounts attach under Campus (not a church hierarchy step; STREAM removed).
        let parentLevel: OrganisationLevel | null = null;
        if (parentId) {
            const parent = await prisma.organisation.findUnique({
                where: { id: parentId },
                select: { level: true, isActive: true },
            });
            if (!parent || !parent.isActive) {
                return NextResponse.json({ error: 'Parent church not found or inactive' }, { status: 400 });
            }
            parentLevel = parent.level;
        }

        const parentCheck = validateParentChild(level, parentLevel);
        if (!parentCheck.ok) {
            return NextResponse.json({ error: parentCheck.error }, { status: 400 });
        }

        const accountTypeCheck = validateAccountTypeForLevel(level, accountType as AccountType | undefined);
        if (!accountTypeCheck.ok) {
            return NextResponse.json({ error: accountTypeCheck.error }, { status: 400 });
        }

        // Create the organisation
        const organisation = await prisma.organisation.create({
            data: {
                id: crypto.randomUUID(),
                name,
                level,
                parentId: parentId || null,
                accountType: accountTypeCheck.accountType,
                updatedAt: new Date(),
            },
        });

        // Get the appropriate leader role for this organisation level
        const leaderRole = getLeaderRoleForLevel(level);

        // Create UserRole for the leader
        const userRole = await prisma.userRole.create({
            data: {
                id: crypto.randomUUID(),
                userId: leaderId,
                role: leaderRole,
                organisationId: organisation.id,
                updatedAt: new Date(),
            },
        });

        // Update the leader's organisationId and activeRole if this is their first role
        const isFirstRole = leader.userRoles.length === 0;
        await prisma.user.update({
            where: { id: leaderId },
            data: {
                organisationId: isFirstRole ? organisation.id : leader.organisationId,
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

            // Send auth setup via SMS and/or email
            const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.com';
            const resetLink = `${baseUrl.replace(/\/+$/, '')}/auth/reset-password?token=${resetToken}`;

            const smsMessage = await generateFirstRoleAssignmentSms({
                userName: leader.name || 'User',
                role: leaderRole,
                organisation: name,
                resetLink,
            });

            try {
                if (leader.phone) {
                    await sendSms({
                        to: formatGhanaPhone(leader.phone),
                        message: smsMessage,
                    });
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
            }

            if (leader.email && isEmailConfigured()) {
                const { subject, html } = generateFirstRoleAssignmentEmail({
                    userName: leader.name || 'User',
                    role: leaderRole,
                    organisation: name,
                    resetLink,
                });
                await sendEmail({ to: leader.email, subject, html });
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
                        organisationId: organisation.id,
                        updatedAt: new Date(),
                    },
                });

                // Update the admin's user record
                const isAdminFirstRole = admin.userRoles.length === 0;
                await prisma.user.update({
                    where: { id: adminId },
                    data: {
                        organisationId: isAdminFirstRole ? organisation.id : admin.organisationId,
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
                    const resetLink = `${baseUrl.replace(/\/+$/, '')}/auth/reset-password?token=${resetToken}`;

                    const smsMessage = await generateFirstRoleAssignmentSms({
                        userName: admin.name || 'User',
                        role: adminRole,
                        organisation: name,
                        resetLink,
                    });

                    try {
                        if (admin.phone) {
                            await sendSms({
                                to: formatGhanaPhone(admin.phone),
                                message: smsMessage,
                            });
                        }
                    } catch (smsError) {
                        console.error('Failed to send SMS to admin:', smsError);
                    }

                    if (admin.email && isEmailConfigured()) {
                        const { subject, html } = generateFirstRoleAssignmentEmail({
                            userName: admin.name || 'User',
                            role: adminRole,
                            organisation: name,
                            resetLink,
                        });
                        await sendEmail({ to: admin.email, subject, html });
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
                entityType: 'Organisation',
                entityId: organisation.id,
                afterData: { name, level, parentId, leaderId, leaderRole, adminId, adminRole },
                description: `Created organisation ${name} with ${leader.name || leader.email} as ${leaderRole}${admin ? ` and ${admin.name || admin.email} as ${adminRole}` : ''}`,
            },
        });

        return NextResponse.json(organisation);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
