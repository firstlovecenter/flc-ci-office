import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionStatus } from '@prisma/client';
import { getDescendantOrganisationIds } from '@/lib/organisations';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role || '';
        const userRoles = Array.isArray(session.user.roles) 
            ? session.user.roles.map(role => (typeof role === 'string' ? role.toUpperCase() : ''))
            : [];
        const userId = session.user.id;

        // Only admins see pending approvals
        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        const isAdmin = adminRoles.includes(userRole);

        // Determine which organisation to use for filtering
        // For users with multiple roles, use the activeUserRole's organisation
        let filterOrganisationId = session.user.organisationId;
        
        if (session.user.activeUserRole?.organisationId) {
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        const isCampusAdmin = userRole === 'CAMPUS_ADMIN' || userRoles.includes('CAMPUS_ADMIN');
        const isSuperAdmin = userRole === 'SUPERADMIN' || userRoles.includes('SUPERADMIN');
        const isDenominationAdmin = userRole === 'DENOMINATION_ADMIN' || userRoles.includes('DENOMINATION_ADMIN');

        // For campus admin badge count: resolve the correct campus organisation.
        let campusOrganisationIdForCount: string | undefined;
        if (isCampusAdmin && !isSuperAdmin) {
            if ((session.user.activeUserRole as any)?.role === 'CAMPUS_ADMIN') {
                campusOrganisationIdForCount = session.user.activeUserRole?.organisationId ?? undefined;
            } else {
                const campusUserRole = await prisma.userRole.findFirst({
                    where: { userId: userId, role: 'CAMPUS_ADMIN' },
                    select: { organisationId: true },
                });
                campusOrganisationIdForCount = campusUserRole?.organisationId ?? undefined;
            }
        }

        // Run queries in parallel for better performance
        const [pendingApprovals, pendingTransactions, pendingPublicRequests] = await Promise.all([
            isAdmin ? (
                isSuperAdmin || isDenominationAdmin
                    ? prisma.transaction.count({
                        where: { status: TransactionStatus.PENDING },
                    })
                    : filterOrganisationId
                    ? prisma.transaction.count({
                        where: {
                            status: TransactionStatus.PENDING,
                            organisationId: {
                                in: await getDescendantOrganisationIds(filterOrganisationId)
                            }
                        },
                    })
                    : Promise.resolve(0)
            ) : Promise.resolve(0),
            prisma.transaction.count({
                where: {
                    userId: userId,
                    status: TransactionStatus.PENDING,
                },
            }),
            isSuperAdmin
                ? prisma.publicExpenseRequest.count({
                    where: { status: 'PENDING' },
                })
                : isCampusAdmin && campusOrganisationIdForCount
                ? prisma.publicExpenseRequest.count({
                    where: {
                        campusOrganisationId: campusOrganisationIdForCount,
                        status: 'PENDING',
                    },
                })
                : Promise.resolve(0),
        ]);

        return NextResponse.json(
            {
                approvals: pendingApprovals,
                transactions: pendingTransactions,
                publicRequests: pendingPublicRequests,
            },
            {
                headers: {
                    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (error) {
        console.error('[PendingCounts] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending counts' },
            { status: 500 }
        );
    }
}
