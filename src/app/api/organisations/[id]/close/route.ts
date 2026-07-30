import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasOrganisationAccess } from '@/lib/organisations';
import crypto from 'crypto';

export async function POST(
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
        const body = await request.json();
        const { reason } = body;

        // Only leaders and admins at or above this organisation level can close it
        const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        
        const hasAccess = await hasOrganisationAccess(
            { role: session.user.role, organisationId: filterOrganisationId },
            organisationId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to close this organisation' },
                { status: 403 }
            );
        }

        // Get the organisation with its children and user roles
        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true },
                    take: 1,
                },
            },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        if (!organisation.isActive) {
            return NextResponse.json({ error: 'Organisation is already closed' }, { status: 400 });
        }

        // Check for active child organisations
        if (organisation.children.length > 0) {
            return NextResponse.json(
                { 
                    error: 'Cannot close organisation with active child organisations',
                    childOrganisations: organisation.children.map(c => c.name),
                },
                { status: 400 }
            );
        }

        // Get users who will lose access (users with roles in this organisation)
        const affectedUsers = organisation.userRoles.map(ur => ({
            id: ur.user.id,
            name: ur.user.name,
            email: ur.user.email,
            role: ur.role,
        }));

        // Start transaction to close organisation and remove user access
        await prisma.$transaction(async (tx) => {
            // 1. Remove all user roles for this organisation
            const userRolesToRemove = await tx.userRole.findMany({
                where: { organisationId },
            });

            for (const userRole of userRolesToRemove) {
                // Delete the user role
                await tx.userRole.delete({
                    where: { id: userRole.id },
                });

                // Check if this was the user's active role
                const user = await tx.user.findUnique({
                    where: { id: userRole.userId },
                    select: { activeUserRoleId: true },
                });

                if (user?.activeUserRoleId === userRole.id) {
                    // Find another role for this user
                    const remainingRole = await tx.userRole.findFirst({
                        where: { userId: userRole.userId },
                    });

                    if (remainingRole) {
                        // Set the next available role as active
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: remainingRole.id,
                                activeRole: remainingRole.role,
                                organisationId: remainingRole.organisationId,
                            },
                        });
                    } else {
                        // User has no more roles - clear their access
                        await tx.user.update({
                            where: { id: userRole.userId },
                            data: {
                                activeUserRoleId: null,
                                activeRole: null,
                                organisationId: null,
                            },
                        });
                    }
                }
            }

            // 2. Remove users from being directly assigned to this organisation
            await tx.user.updateMany({
                where: { organisationId },
                data: { organisationId: null },
            });

            // 3. Close the organisation (soft delete)
            await tx.organisation.update({
                where: { id: organisationId },
                data: {
                    isActive: false,
                    closedAt: new Date(),
                    closedBy: session.user.id,
                    closureReason: reason || null,
                },
            });

            // 4. Create audit log
            await tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    actionType: 'DELETE',
                    entityType: 'Organisation',
                    entityId: organisationId,
                    beforeData: {
                        name: organisation.name,
                        level: organisation.level,
                        isActive: true,
                        affectedUsers: affectedUsers,
                    },
                    afterData: {
                        name: organisation.name,
                        level: organisation.level,
                        isActive: false,
                        closedAt: new Date().toISOString(),
                        closureReason: reason,
                    },
                    description: `Closed organisation "${organisation.name}" (${organisation.level}). ${affectedUsers.length} user role(s) removed.`,
                    severity: 'HIGH',
                },
            });
        });

        return NextResponse.json({ 
            success: true,
            message: `Organisation "${organisation.name}" has been closed`,
            affectedUsers: affectedUsers.length,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to close organisation' },
            { status: 500 }
        );
    }
}

// GET endpoint to check if organisation can be closed (pre-validation)
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

        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, level: true },
                },
                userRoles: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                transactions: {
                    select: { id: true, status: true },
                },
            },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        const canClose = organisation.isActive && organisation.children.length === 0;
        const warnings: string[] = [];
        const blockers: string[] = [];

        if (!organisation.isActive) {
            blockers.push('Organisation is already closed');
        }

        if (organisation.children.length > 0) {
            blockers.push(`Has ${organisation.children.length} active child organisation(s): ${organisation.children.map(c => c.name).join(', ')}`);
        }

        if (organisation.userRoles.length > 0) {
            warnings.push(`${organisation.userRoles.length} user(s) will lose access to this organisation`);
        }

        if (organisation.transactions.length > 0) {
            const pendingCount = organisation.transactions.filter(t => t.status === 'PENDING').length;
            warnings.push(`${organisation.transactions.length} transaction(s) are associated with this organisation (${pendingCount} pending)`);
            warnings.push('Transactions will be preserved for historical records');
        }

        return NextResponse.json({
            canClose,
            organisation: {
                id: organisation.id,
                name: organisation.name,
                level: organisation.level,
                isActive: organisation.isActive,
            },
            affectedUsers: organisation.userRoles.map(ur => ({
                id: ur.user.id,
                name: ur.user.name || ur.user.email,
                role: ur.role,
            })),
            childOrganisations: organisation.children,
            transactionCount: organisation.transactions.length,
            warnings,
            blockers,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to check organisation' },
            { status: 500 }
        );
    }
}
