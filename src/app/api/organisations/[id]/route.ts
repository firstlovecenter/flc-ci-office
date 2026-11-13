import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditActorId } from '@/lib/audit-actor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrganisationAccess, getLeaderRoleForLevel, getAdminRoleForLevel, canCreateOrganisationLevel } from '@/lib/organisations';
import { canAdministerOrganisation, canAssignRole, ORGANISATION_HIERARCHY } from '@/lib/roles';
import { authorizeTargetUser, callerOrganisationId, getCallerScope, loadTargetScope } from '@/lib/user-scope';
import { validateParentChild, validateAccountTypeForLevel } from '@/lib/org-model';
import { sendSetupLinkEmail } from '@/lib/password-reset';
import { syncLegacyUserColumns } from '@/lib/user-claims';
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
            return new NextResponse('Church not found', { status: 404 });
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

        // Editing is admin-only. Scope alone is not enough: `hasOrganisationAccess`
        // returns true for a user's own organisation regardless of role, which
        // would otherwise let a leader rename their church or reassign its
        // leader and manager to someone else.
        if (!canAdministerOrganisation(session.user.role)) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this church' },
                { status: 403 }
            );
        }

        // Check if user has access to this organisation
        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;

        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            organisationId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this church' },
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
            return NextResponse.json({ error: 'Church not found' }, { status: 404 });
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

        // ── Privileged changes ────────────────────────────────────────────────
        // Level, parent and leader/admin assignment are compared against the
        // stored values: the edit dialog re-sends all of them on every save, so
        // an unchanged value must neither need a privilege nor trip a 403.
        if (level !== undefined && !Object.hasOwn(ORGANISATION_HIERARCHY, level)) {
            return NextResponse.json({ error: 'Invalid church level' }, { status: 400 });
        }
        if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 200)) {
            return NextResponse.json({ error: 'Name must be between 1 and 200 characters' }, { status: 400 });
        }

        const isSuperAdmin = session.user.role === 'SUPERADMIN';
        const callerOrgId = callerOrganisationId(session);
        const levelChanged = level !== undefined && level !== currentOrganisation.level;
        const parentChanged = parentId !== undefined && (parentId || null) !== currentOrganisation.parentId;
        const nextAdminRole = getAdminRoleForLevel(nextLevel);
        const leaderChanged = !!leaderId && leaderId !== currentLeaderRole?.userId;
        const adminChanged =
            !!nextAdminRole && adminId !== undefined && (adminId || null) !== (currentAdminRole?.userId ?? null);

        const forbid = (error: string) => NextResponse.json({ error }, { status: 403 });

        if (!isSuperAdmin) {
            if ((levelChanged || parentChanged) && organisationId === callerOrgId) {
                return forbid('You cannot change the level or parent of your own church');
            }

            if (levelChanged) {
                if (currentOrganisation.level === 'COUNCIL' || nextLevel === 'COUNCIL') {
                    return forbid('Only a super admin can convert between a church and an account');
                }
                let callerLevel: OrganisationLevel | undefined;
                if (callerOrgId) {
                    const callerOrg = await prisma.organisation.findUnique({
                        where: { id: callerOrgId },
                        select: { level: true },
                    });
                    callerLevel = callerOrg?.level ?? undefined;
                }
                if (!canCreateOrganisationLevel(session.user.role, callerLevel, nextLevel)) {
                    return forbid('You do not have permission to set this church level');
                }
                const rewrittenRoles = [
                    currentLeaderRole ? getLeaderRoleForLevel(nextLevel) : null,
                    currentAdminRole ? nextAdminRole : null,
                ];
                if (rewrittenRoles.some((r) => r && !canAssignRole(session.user.role, r))) {
                    return forbid('You do not have permission to grant the roles this level implies');
                }
            }

            if (parentChanged) {
                const scope = await getCallerScope({ role: session.user.role, organisationId: callerOrgId });
                if (!nextParentId || scope === 'ALL' || !scope.has(nextParentId)) {
                    return forbid('You do not have access to the selected parent church');
                }
            }

            if (leaderChanged && !canAssignRole(session.user.role, getLeaderRoleForLevel(nextLevel))) {
                return forbid('You do not have permission to assign this role');
            }
            if (adminChanged && nextAdminRole && !canAssignRole(session.user.role, nextAdminRole)) {
                return forbid('You do not have permission to assign this role');
            }
        }

        // Anyone newly granted a role must exist, be active and — for a
        // non-super caller — not belong to another tenant.
        const incomingUserIds = [leaderChanged ? leaderId : null, adminChanged && adminId ? adminId : null];
        for (const uid of incomingUserIds) {
            if (!uid) continue;
            const target = await loadTargetScope(uid);
            if (!target || target.archived) {
                return NextResponse.json({ error: 'Selected user not found or inactive' }, { status: 400 });
            }
            const decision = await authorizeTargetUser(
                { id: session.user.id, role: session.user.role, organisationId: callerOrgId },
                target,
                { allowUnassigned: true },
            );
            if (!decision.ok) return forbid(decision.error);
        }

        let parentLevel: OrganisationLevel | null = null;
        if (nextParentId) {
            const parent = await prisma.organisation.findUnique({
                where: { id: nextParentId },
                select: { level: true, isActive: true },
            });
            if (!parent || !parent.isActive) {
                return NextResponse.json({ error: 'Parent church not found or inactive' }, { status: 400 });
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

                await syncLegacyUserColumns(prisma, currentLeaderRole.userId);
            }

            // Update existing admin's role if they exist and new level has admin role
            if (currentAdminRole && newAdminRole) {
                await prisma.userRole.update({
                    where: { id: currentAdminRole.id },
                    data: { role: newAdminRole },
                });

                await syncLegacyUserColumns(prisma, currentAdminRole.userId);
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

                    // Recompute the legacy columns from whatever roles remain.
                    await syncLegacyUserColumns(prisma, currentLeaderId as string);
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

                // Send auth setup by email
                const needsPasswordSetup = !newLeader.password || newLeader.password === '';
                
                if (isFirstRole || needsPasswordSetup) {
                    // Setup link is delivered by email only; users without an email get none.
                    await sendSetupLinkEmail({ user: newLeader, role: leaderRole, organisationName: name });

                }

                // Audit the leader change
                await prisma.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: auditActorId(session),
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

                    // Recompute the legacy columns from whatever roles remain.
                    await syncLegacyUserColumns(prisma, currentAdminId as string);
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

                    // Send auth setup by email
                    const needsPasswordSetup = !newAdmin.password || newAdmin.password === '';
                    
                    if (isFirstRole || needsPasswordSetup) {
                        // Setup link is delivered by email only; users without an email get none.
                        await sendSetupLinkEmail({ user: newAdmin, role: adminRole, organisationName: name });

                    }

                    // Audit the admin change
                    await prisma.auditLog.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: auditActorId(session),
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
                            userId: auditActorId(session),
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
                userId: auditActorId(session),
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
                { error: 'Only superadmin can delete churches' },
                { status: 403 }
            );
        }

        // Check if organisation has children
        const children = await prisma.organisation.findMany({
            where: { parentId: organisationId },
        });

        if (children.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete church with child churches' },
                { status: 400 }
            );
        }

        // Check if organisation has users
        const users = await prisma.user.findMany({
            where: { organisationId },
        });

        if (users.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete church with assigned users' },
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
                userId: auditActorId(session),
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
