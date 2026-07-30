import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantOrganisationIds, hasOrganisationAccess } from '@/lib/organisations';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { id } = await params;

        // Verify organisation access for non-superadmins
        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            const hasAccess = await hasOrganisationAccess(
                { role: session.user.role, organisationId: filterOrganisationId },
                id
            );
            if (!hasAccess) {
                return new NextResponse('Forbidden', { status: 403 });
            }
        }

        // Get all descendant organisation IDs
        const descendantIds = await getDescendantOrganisationIds(id);

        // Count users in this organisation and descendants
        const usersCount = await prisma.user.count({
            where: {
                organisationId: {
                    in: descendantIds,
                },
            },
        });

        // Count immediate sub-organisations
        const subOrganisationsCount = await prisma.organisation.count({
            where: {
                parentId: id,
            },
        });

        // Count transactions in this organisation and descendants
        const transactionsCount = await prisma.transaction.count({
            where: {
                organisationId: {
                    in: descendantIds,
                },
            },
        });

        // Get recent transactions
        const recentTransactions = await prisma.transaction.findMany({
            where: {
                organisationId: {
                    in: descendantIds,
                },
            },
            include: { organisation: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
        });

        return NextResponse.json({
            users: usersCount,
            subOrganisations: subOrganisationsCount,
            transactions: transactionsCount,
            recentTransactions,
        });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
