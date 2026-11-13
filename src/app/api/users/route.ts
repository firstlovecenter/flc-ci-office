import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getDescendantOrganisationIds } from '@/lib/organisations';
import { validateRoleAssignment } from '@/lib/roleValidation';
import crypto from 'crypto';
import { canAssignRole, ROLE_HIERARCHY } from '@/lib/roles';
import { sendSetupLinkEmail } from '@/lib/password-reset';
import type { Role } from '@prisma/client';

// Force dynamic rendering - user list is role/organisation specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can list users
    // TODO: Add more granular checks
    if (!['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const availableOnly = searchParams.get('available') === 'true';
        
        let whereClause: any = {
            archived: false, // Only show non-archived users by default
        };

        // Determine which organisation to use for filtering
        // For users with multiple roles, use the activeUserRole's organisation
        let filterOrganisationId = session.user.organisationId;
        
        if (session.user.activeUserRole?.organisationId) {
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        // Visibility is derived from live UserRole rows, never the legacy
        // organisationId alone (null there must not read as "unrestricted").
        const allowedOrganisationIds = filterOrganisationId
            ? await getDescendantOrganisationIds(filterOrganisationId)
            : [];

        if (session.user.role !== 'SUPERADMIN') {
            if (availableOnly) {
                // Leader selection: users with no live role at all (nothing to
                // be cross-tenant with), or whose every live role is in scope.
                // Pinned global admins without role rows are never offered.
                whereClause.OR = [
                    {
                        userRoles: { none: {} },
                        OR: [
                            { activeRole: null },
                            { activeRole: { notIn: ['SUPERADMIN', 'DENOMINATION_ADMIN'] } },
                        ],
                    },
                    {
                        userRoles: {
                            some: { organisationId: { in: allowedOrganisationIds } },
                            none: { organisationId: { notIn: allowedOrganisationIds } },
                        },
                    },
                ];
            } else {
                if (!filterOrganisationId) {
                    // User has no organisation, can't see any users
                    return NextResponse.json([]);
                }
                whereClause.userRoles = { some: { organisationId: { in: allowedOrganisationIds } } };
            }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: { organisation: true,
                baseCurrency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
                userRoles: {
                    include: { organisation: {
                            select: {
                                id: true,
                                name: true,
                                level: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });

        // Remove passwords from response
        const safeUsers = users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });

        return NextResponse.json(safeUsers);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user has admin role
    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
        return new NextResponse('Forbidden - Admin role required', { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, name, email, phone, roleOrganisationPairs } = body;

        if (!phone?.trim()) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
            return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }
        if (name !== undefined && name !== null && (typeof name !== 'string' || name.length > 100)) {
            return NextResponse.json({ error: 'Name must be at most 100 characters' }, { status: 400 });
        }

        // Users can be created without roles initially.
        const rawPairs = roleOrganisationPairs ?? [];
        if (!Array.isArray(rawPairs) || rawPairs.length > 20) {
            return NextResponse.json({ error: 'Invalid role assignments' }, { status: 400 });
        }
        const seen = new Set<string>();
        const pairs: Array<{ role: Role; organisationId: string }> = [];
        for (const pair of rawPairs) {
            if (
                !pair || typeof pair.role !== 'string' || typeof pair.organisationId !== 'string' ||
                !Object.hasOwn(ROLE_HIERARCHY, pair.role)
            ) {
                return NextResponse.json({ error: 'Invalid role assignments' }, { status: 400 });
            }
            const key = `${pair.role}:${pair.organisationId}`;
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push({ role: pair.role as Role, organisationId: pair.organisationId });
            }
        }
        const hasRoles = pairs.length > 0;
        const userRoles: string[] = Array.from(new Set(pairs.map((p) => p.role as string)));
        const firstDept = hasRoles ? pairs[0].organisationId : null;

        // The caller may only grant roles strictly below their own.
        for (const role of userRoles) {
            if (!canAssignRole(session.user.role, role)) {
                return NextResponse.json({ error: `You cannot assign the role: ${role}` }, { status: 403 });
            }
        }

        if (hasRoles) {
            const validation = await validateRoleAssignment('new-user', userRoles, firstDept, email);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
        });
        if (existingUser) {
            return new NextResponse('User already exists', { status: 400 });
        }

        // For non-superadmins, every target organisation must be inside their subtree.
        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            if (!filterOrganisationId) {
                return new NextResponse('Forbidden - No organisation assigned', { status: 403 });
            }
            const allowedOrganisationIds = await getDescendantOrganisationIds(filterOrganisationId);
            for (const pair of pairs) {
                if (!allowedOrganisationIds.includes(pair.organisationId)) {
                    return new NextResponse('Forbidden - Cannot create user in this organisation', { status: 403 });
                }
            }
        }

        // The user and every role row are created together: a failure leaves
        // nothing behind (no half-committed privileged user).
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);
        const now = new Date();
        const userId = crypto.randomUUID();
        const roleRows = pairs.map((p) => ({
            id: crypto.randomUUID(),
            userId,
            role: p.role,
            organisationId: p.organisationId,
            updatedAt: now,
        }));

        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    id: userId,
                    title: title?.trim() || null,
                    name,
                    email: email.trim().toLowerCase(),
                    phone: phone.trim(),
                    password: passwordHash,
                    // Legacy columns mirror the first live role row.
                    activeRole: hasRoles ? roleRows[0].role : null,
                    organisationId: firstDept,
                    updatedAt: now,
                },
            });
            if (hasRoles) {
                await tx.userRole.createMany({ data: roleRows });
                return tx.user.update({
                    where: { id: userId },
                    data: { activeUserRoleId: roleRows[0].id },
                });
            }
            return created;
        });

        // Setup link is delivered by email only.
        if (hasRoles) {
            const organisation = await prisma.organisation.findUnique({
                where: { id: pairs[0].organisationId },
                select: { name: true },
            });
            await sendSetupLinkEmail({
                user: { id: user.id, name: user.name, email: user.email },
                role: pairs[0].role,
                organisationName: organisation?.name || 'Unknown church',
            });
        }

        const { password: _, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
