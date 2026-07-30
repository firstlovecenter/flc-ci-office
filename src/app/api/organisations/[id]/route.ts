import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrganisationAccess, getLeaderRoleForLevel, getAdminRoleForLevel } from '@/lib/organisations';
import { validateParentChild, validateAccountTypeForLevel } from '@/lib/org-model';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generateFirstRoleAssignmentSms } from '@/lib/sms-templates';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generateFirstRoleAssignmentEmail } from '@/lib/email-templates';
import crypto from 'crypto';
import type { AccountType, OrganisationLevel } from '@prisma/client';

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
        const organisationId = params.id;

        // Verify organisation access for non-superadmins
        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            const hasAccess = await hasOrganisationAccess(
                { role: session.user.role, organisationId: filterOrganisationId },
                organisationId
            );
            if (!hasAccess) {
                return new NextResponse('Forbidden', { status: 403 });
            }
        }

        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
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

        if (!organisation) {
            return new NextResponse('Organisation not found', { status: 404 });
        }

        return NextResponse.json(organisation);
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
        const { name, level, parentId, leaderId, adminId, publicFormEnabled, accountType } = body;
        const organisationId = params.id;

        // Check if user has access to this organisation
        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        
        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            organisationId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this organisation' },
                { status: 403 }
            );
        }

        // Get current organisation with its leader and admin
        const currentOrganisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
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

        if (!currentOrganisation) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        // Separate leader and admin roles
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 
                            'STREAM_LEADER', 'COUNCIL_LEADER'];
        const adminRoles = ['DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN',
                           'CAMPUS_ADMIN'];
        
        const currentLeaderRole = currentOrganisation.userRoles.find(
            (ur) => ur.role && leaderRoles.includes(ur.role)
        );
        const currentAdminRole = currentOrganisation.userRoles.find(
            (ur) => ur.role && adminRoles.includes(ur.role)
        );

        // Validate hierarchy / account type before writing
        const nextLevel = (level || currentOrganisation.level) as OrganisationLevel;
        const nextParentId = parentId === undefined ? currentOrganisation.parentId : (parentId || null);

        let parentLevel: OrganisationLevel | null = null;
        if (nextParentId) {
            const parent = await prisma.organisation.findUnique({
                where: { id: nextParentId },
                select: { level: true, isActive: true },
            });
            if (!parent || !parent.isActive) {
                return NextResponse.json({ error: 'Parent organisation not found or inactive' }, { status: 400 });
            }
            parentLevel = parent.level;
        }

        const parentCheck = validateParentChild(nextLevel, parentLevel);
        if (!parentCheck.ok) {
            return NextResponse.json({ error: parentCheck.error }, { status: 400 });
        }

        const resolvedAccountType =
            accountType !== undefined
                ? accountType
                : nextLevel === 'COUNCIL'
                    ? currentOrganisation.accountType
                    : null;
        const accountTypeCheck = validateAccountTypeForLevel(nextLevel, resolvedAccountType as AccountType | null | undefined);
        if (!accountTypeCheck.ok) {
            return NextResponse.json({ error: accountTypeCheck.error }, { status: 400 });
        }

        // Update the organisation
        const updatedOrganisation = await prisma.organisation.update({
            where: { id: organisationId },
            data: {
                name,
                level: nextLevel,
                parentId: nextParentId,
                accountType: accountTypeCheck.accountType,
                ...(typeof publicFormEnabled === 'boolean' ? { publicFormEnabled } : {}),
            },
        });

        // If level changed, update existing leader and admin roles to match new level
        if (nextLevel !== currentOrganisation.level) {
            const newLeaderRole = getLeaderRoleForLevel(nextLevel);
            const newAdminRole = getAdminRoleForLevel(nextLevel);

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
                const leaderRole = getLeaderRoleForLevel(nextLevel);
                
                // Remove old leader's role for this organisation
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
                                organisationId: null,
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
                                organisationId: newActiveRole.organisationId,
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
                        organisationId: organisationId,
                        updatedAt: new Date(),
                    },
                });

                // Update new leader's user record
                const isFirstRole = newLeader.userRoles.length === 0;
                await prisma.user.update({
                    where: { id: leaderId },
                    data: {
                        organisationId: isFirstRole ? organisationId : newLeader.organisationId,
                        activeRole: isFirstRole ? leaderRole : newLeader.activeRole,
                        activeUserRoleId: isFirstRole ? newUserRole.id : newLeader.activeUserRoleId,
                        updatedAt: new Date(),
                    },
                });

                // Send auth setup via SMS and/or email
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
                    const resetLink = `${baseUrl.replace(/\/+$/, '')}/auth/reset-password?token=${resetToken}`;

                    const smsMessage = await generateFirstRoleAssignmentSms({
                        userName: newLeader.name || 'User',
                        role: leaderRole,
                        organisation: name,
                        resetLink,
                    });

                    try {
                        if (newLeader.phone) {
                            await sendSms({
                                to: formatGhanaPhone(newLeader.phone),
                                message: smsMessage,
                            });
                        }
                    } catch (smsError) {
                        console.error('Failed to send SMS to new leader:', smsError);
                    }

                    if (newLeader.email && isEmailConfigured()) {
                        const { subject, html } = generateFirstRoleAssignmentEmail({
                            userName: newLeader.name || 'User',
                            role: leaderRole,
                            organisation: name,
                            resetLink,
                        });
                        await sendEmail({ to: newLeader.email, subject, html });
                    }

                }

                // Audit the leader change
                await prisma.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        actionType: 'UPDATE',
                        entityType: 'Organisation',
                        entityId: organisationId,
                        beforeData: { leaderId: currentLeaderId, leaderName: currentLeaderRole?.user?.name },
                        afterData: { leaderId, leaderName: newLeader.name, leaderRole },
                        description: `Changed leader of ${name} from ${currentLeaderRole?.user?.name || 'none'} to ${newLeader.name}`,
                    },
                });
            }
        }

        // Handle admin change if adminId is provided
        const adminRole = getAdminRoleForLevel(nextLevel);
        if (adminRole && adminId !== undefined) {
            const currentAdminId = currentAdminRole?.userId;
            
            // Only process if admin is changing
            if (currentAdminId !== adminId) {
                // Remove old admin's role for this organisation
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
                                organisationId: null,
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
                                organisationId: newActiveRole.organisationId,
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
                            organisationId: organisationId,
                            updatedAt: new Date(),
                        },
                    });

                    // Update new admin's user record
                    const isFirstRole = newAdmin.userRoles.length === 0;
                    await prisma.user.update({
                        where: { id: adminId },
                        data: {
                            organisationId: isFirstRole ? organisationId : newAdmin.organisationId,
                            activeRole: isFirstRole ? adminRole : newAdmin.activeRole,
                            activeUserRoleId: isFirstRole ? newUserRole.id : newAdmin.activeUserRoleId,
                            updatedAt: new Date(),
                        },
                    });

                    // Send auth setup via SMS and/or email
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
                        const resetLink = `${baseUrl.replace(/\/+$/, '')}/auth/reset-password?token=${resetToken}`;

                        const smsMessage = await generateFirstRoleAssignmentSms({
                            userName: newAdmin.name || 'User',
                            role: adminRole,
                            organisation: name,
                            resetLink,
                        });

                        try {
                            if (newAdmin.phone) {
                                await sendSms({
                                    to: formatGhanaPhone(newAdmin.phone),
                                    message: smsMessage,
                                });
                            }
                        } catch (smsError) {
                            console.error('Failed to send SMS to new admin:', smsError);
                        }

                        if (newAdmin.email && isEmailConfigured()) {
                            const { subject, html } = generateFirstRoleAssignmentEmail({
                                userName: newAdmin.name || 'User',
                                role: adminRole,
                                organisation: name,
                                resetLink,
                            });
                            await sendEmail({ to: newAdmin.email, subject, html });
                        }

                    }

                    // Audit the admin change
                    await prisma.auditLog.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: session.user.id,
                            actionType: 'UPDATE',
                            entityType: 'Organisation',
                            entityId: organisationId,
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
                            entityType: 'Organisation',
                            entityId: organisationId,
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
                entityType: 'Organisation',
                entityId: updatedOrganisation.id,
                afterData: JSON.parse(JSON.stringify(updatedOrganisation)),
            },
        });

        return NextResponse.json(updatedOrganisation);
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
        const organisationId = params.id;

        // Only superadmin can delete organisations
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only superadmin can delete organisations' },
                { status: 403 }
            );
        }

        // Check if organisation has children
        const children = await prisma.organisation.findMany({
            where: { parentId: organisationId },
        });

        if (children.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete organisation with child organisations' },
                { status: 400 }
            );
        }

        // Check if organisation has users
        const users = await prisma.user.findMany({
            where: { organisationId },
        });

        if (users.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete organisation with assigned users' },
                { status: 400 }
            );
        }

        // Get the organisation to check its level
        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            select: { level: true },
        });

        // If it's an OVERSIGHT level organisation, delete its base currency first
        if (organisation?.level === 'OVERSIGHT') {
            await prisma.organisationBaseCurrency.deleteMany({
                where: { organisationId },
            });
        }

        // Delete the organisation
        await prisma.organisation.delete({
            where: { id: organisationId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Organisation',
                entityId: organisationId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
