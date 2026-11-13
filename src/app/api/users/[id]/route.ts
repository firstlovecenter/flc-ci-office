import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditActorId } from '@/lib/audit-actor';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { sendSetupLinkEmail } from '@/lib/password-reset';
import { canAssignRole, ROLE_HIERARCHY } from '@/lib/roles';
import type { Role } from '@prisma/client';
import { validateRoleAssignment } from '@/lib/roleValidation';
import {
    authorizeTargetUser,
    callerOrganisationId,
    getCallerScope,
    loadTargetScope,
} from '@/lib/user-scope';

const ADMIN_ROLES = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET - Fetch a single user by ID
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        if (!ADMIN_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const params = await context.params;
        const userId = params.id;
        const isSuperAdmin = session.user.role === 'SUPERADMIN';

        // Scope is derived from live roles + the legacy org, and an empty scope
        // fails closed for everyone but SUPERADMIN.
        const scope = await loadTargetScope(userId);
        if (!scope) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const decision = await authorizeTargetUser(
            { id: session.user.id, role: session.user.role, organisationId: callerOrganisationId(session) },
            scope,
        );
        if (!decision.ok) {
            return NextResponse.json({ error: decision.error }, { status: decision.status });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                organisation: { select: { id: true, name: true, level: true } },
                userRoles: {
                    include: { organisation: { select: { id: true, name: true, level: true } } },
                },
                // Audit history (incl. IP addresses) is for SUPERADMIN only.
                ...(isSuperAdmin
                    ? {
                          auditLogs: {
                              select: { id: true, actionType: true, description: true, timestamp: true, ipAddress: true },
                              orderBy: { timestamp: 'desc' as const },
                              take: 50,
                          },
                      }
                    : {}),
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { password: _, ...userWithoutPassword } = user;
        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

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
        const { title, name, email, phone, image, roleOrganisationPairs } = body;
        const userId = params.id;
        const isSuperAdmin = session.user.role === 'SUPERADMIN';

        if (!phone?.trim()) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }
        if (!ADMIN_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }
        if (name !== undefined && name !== null && (typeof name !== 'string' || name.length > 100)) {
            return NextResponse.json({ error: 'Name must be at most 100 characters' }, { status: 400 });
        }

        // Validate requested role/organisation pairs.
        let pairs: Array<{ role: Role; organisationId: string }> | undefined;
        if (roleOrganisationPairs !== undefined) {
            if (!Array.isArray(roleOrganisationPairs) || roleOrganisationPairs.length > 20) {
                return NextResponse.json({ error: 'Invalid role assignments' }, { status: 400 });
            }
            const seen = new Set<string>();
            pairs = [];
            for (const pair of roleOrganisationPairs) {
                if (
                    !pair || typeof pair.role !== 'string' || typeof pair.organisationId !== 'string' ||
                    !Object.hasOwn(ROLE_HIERARCHY, pair.role)
                ) {
                    return NextResponse.json({ error: 'Invalid role assignments' }, { status: 400 });
                }
                const key = `${pair.role}:${pair.organisationId}`;
                if (seen.has(key)) continue;
                seen.add(key);
                pairs.push({ role: pair.role as Role, organisationId: pair.organisationId });
            }
        }

        // The target's authority is judged over ALL of their roles and orgs,
        // never just the legacy activeRole/organisationId columns.
        const targetScope = await loadTargetScope(userId);
        if (!targetScope) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, phone: true, password: true },
        });
        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const caller = { id: session.user.id, role: session.user.role, organisationId: callerOrganisationId(session) };
        const decision = await authorizeTargetUser(caller, targetScope, {
            // Only the first-role-assignment flow may touch a user with no scope.
            allowUnassigned: !!pairs && pairs.length > 0,
            requireHierarchy: true,
        });
        if (!decision.ok) {
            return NextResponse.json({ error: decision.error }, { status: decision.status });
        }

        if (pairs) {
            const userRoles = Array.from(new Set(pairs.map((p) => p.role as string)));
            if (userRoles.length > 0) {
                const validation = await validateRoleAssignment(userId, userRoles, pairs[0].organisationId, email);
                if (!validation.valid) {
                    return NextResponse.json({ error: validation.error }, { status: 400 });
                }
            }
            if (!isSuperAdmin) {
                const scope = await getCallerScope(caller);
                for (const pair of pairs) {
                    if (scope === 'ALL' || !scope.has(pair.organisationId)) {
                        return NextResponse.json(
                            { error: 'Cannot assign user to a church outside your hierarchy' },
                            { status: 403 }
                        );
                    }
                }
            }
            for (const role of userRoles) {
                if (!canAssignRole(session.user.role, role)) {
                    return NextResponse.json({ error: `You cannot assign the role: ${role}` }, { status: 403 });
                }
            }
        }

        const updateData: Record<string, unknown> = {
            title: title?.trim() || null,
            name,
            updatedAt: new Date(),
        };
        if (image !== undefined) {
            updateData.image = image || null;
        }

        // Email is the password-reset channel, so changing it is an account
        // takeover vector. Only SUPERADMIN may change it on an account that can
        // already sign in; an admin may set it on a not-yet-activated account
        // (no password yet). An unchanged value is ignored.
        let emailChanged = false;
        if (typeof email === 'string' && email.trim()) {
            const nextEmail = email.trim().toLowerCase();
            if (!EMAIL_PATTERN.test(nextEmail) || nextEmail.length > 254) {
                return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
            }
            if (nextEmail !== targetUser.email.toLowerCase()) {
                if (!isSuperAdmin && targetUser.password) {
                    return NextResponse.json(
                        { error: 'Only a super admin can change the email of an active account.' },
                        { status: 403 }
                    );
                }
                updateData.email = nextEmail;
                emailChanged = true;
            }
        }

        // Phone number update restriction: only user themselves, SUPERADMIN, or DENOMINATION_ADMIN
        if (phone !== undefined && phone?.trim() !== targetUser.phone) {
            const canUpdatePhone =
                userId === session.user.id ||
                isSuperAdmin ||
                session.user.role === 'DENOMINATION_ADMIN';
            if (!canUpdatePhone) {
                return NextResponse.json({ error: 'You have no access to do this.' }, { status: 403 });
            }
            updateData.phone = phone.trim();
        }

        // User row, role replacement and legacy columns change together or not
        // at all — a failure can never leave a user with zero roles.
        const hadRoles = targetScope.roles.length > 0 && (await prisma.userRole.count({ where: { userId } })) > 0;
        const hasRolesNow = !!pairs && pairs.length > 0;
        const now = new Date();

        await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: userId }, data: updateData });

            if (emailChanged) {
                // Links already sent went to the old address.
                await tx.passwordReset.updateMany({
                    where: { userId, used: false },
                    data: { used: true, usedAt: now },
                });
            }

            if (pairs !== undefined) {
                await tx.userRole.deleteMany({ where: { userId } });
                if (pairs.length > 0) {
                    const rows = pairs.map((p) => ({
                        id: crypto.randomUUID(),
                        userId,
                        role: p.role,
                        organisationId: p.organisationId,
                        updatedAt: now,
                    }));
                    await tx.userRole.createMany({ data: rows });
                    // Legacy columns are derived from the live rows.
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            activeUserRoleId: rows[0].id,
                            activeRole: rows[0].role,
                            organisationId: rows[0].organisationId,
                            updatedAt: now,
                        },
                    });
                } else {
                    // All roles removed — revoke access.
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            password: null,
                            passwordChangedAt: now,
                            activeUserRoleId: null,
                            activeRole: null,
                            organisationId: null,
                            updatedAt: now,
                        },
                    });
                    await tx.passwordReset.updateMany({
                        where: { userId, used: false },
                        data: { used: true, usedAt: now },
                    });
                }
            }
        });

        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { organisation: true },
        });
        if (!updatedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Setup link (email only) for a first assignment, or a re-assignment
        // to someone whose password was revoked.
        if (pairs !== undefined && hasRolesNow && (!hadRoles || !targetUser.password)) {
            try {
                const organisation = await prisma.organisation.findUnique({
                    where: { id: pairs[0].organisationId },
                    select: { name: true },
                });
                await sendSetupLinkEmail({
                    user: { id: userId, name: updatedUser.name, email: updatedUser.email },
                    role: pairs[0].role,
                    organisationName: organisation?.name || 'Unknown church',
                });
            } catch (notificationError) {
                console.error('Failed to send setup email:', notificationError);
            }
        }

        const { password: _, ...userWithoutPassword } = updatedUser;

        // Create audit log (skip for SUPERADMIN)
        if (!isSuperAdmin) {
            await prisma.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: auditActorId(session),
                    actionType: 'UPDATE',
                    entityType: 'User',
                    entityId: updatedUser.id,
                    afterData: { title, name, emailChanged, roleOrganisationPairs: pairs },
                },
            });
        }

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') {
            return NextResponse.json({ error: 'That email or phone number is already in use' }, { status: 409 });
        }
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
            include: { organisation: true },
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user has been involved in any transactions
        const transactionCount = await prisma.transaction.count({
            where: {
                OR: [
                    { userId: userId },
                    { approvedBy: userId },
                    { rejectedBy: userId },
                ],
            },
        });

        if (transactionCount > 0) {
            return NextResponse.json(
                { error: `This user has been involved in ${transactionCount} transaction(s) and cannot be deleted. Please archive the user instead to preserve transaction history.` },
                { status: 400 }
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

        if (typeof archived !== 'boolean') {
            return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
        }

        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        if (userId === session.user.id) {
            return NextResponse.json({ error: 'You cannot archive your own account' }, { status: 400 });
        }

        const scope = await loadTargetScope(userId);
        if (!scope) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Highest role over ALL of the target's roles, every org inside the
        // caller's subtree, and an empty scope fails closed.
        const decision = await authorizeTargetUser(
            { id: session.user.id, role: session.user.role, organisationId: callerOrganisationId(session) },
            scope,
            { requireHierarchy: true },
        );
        if (!decision.ok) {
            return NextResponse.json({ error: decision.error }, { status: decision.status });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { archived },
            include: { organisation: true },
        });

        const { password: _, ...userWithoutPassword } = updatedUser;

        if (session.user.role !== 'SUPERADMIN') {
            await prisma.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: auditActorId(session),
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
