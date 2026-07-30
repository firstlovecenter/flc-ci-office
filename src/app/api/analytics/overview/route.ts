import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const normalizedRole = (session.user.role || '').toUpperCase();
        // Check if user has analytics access (CAMPUS_ADMIN and above, including leaders)
        const hasAccess = [
            'SUPERADMIN',
            'DENOMINATION_ADMIN',
            'DENOMINATION_LEADER',
            'OVERSIGHT_ADMIN',
            'OVERSIGHT_LEADER',
            'CAMPUS_ADMIN',
            'CAMPUS_LEADER'
        ].includes(normalizedRole);

        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const organisationId = searchParams.get('organisationId');

        // Build date filter
        const dateFilter = startDate && endDate ? {
            createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            }
        } : {};

        // Build organisation filter based on user role
        let organisationIds: string[] | null = null;
        
        if (normalizedRole !== 'SUPERADMIN') {
            // Non-superadmins are restricted to their tree
            // Use activeUserRole if available, otherwise use user's base organisation
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;

            if (filterOrganisationId) {
                const allSubDepts = await getAllSubOrganisations(filterOrganisationId);
                const allowedIds = [filterOrganisationId, ...allSubDepts];
                
                if (organisationId) {
                    // User requested specific organisation - verify access
                    if (allowedIds.includes(organisationId)) {
                        organisationIds = [organisationId];
                    } else {
                        // Requested organisation is out of scope -> return forbidden or empty
                        // Returning empty filter with ID='none' to match nothing
                        organisationIds = ['__NO_ACCESS__']; 
                    }
                } else {
                    // No specific organisation requested -> show all in scope
                    organisationIds = allowedIds;
                }
            } else {
                // User has no organisation -> see nothing
                organisationIds = ['__NO_ACCESS__'];
            }
        } else {
            // Superadmin
            if (organisationId) {
                organisationIds = [organisationId];
            }
        }

        const transactionDeptFilter = organisationIds
            ? { organisationId: { in: organisationIds } }
            : {};

        const userDeptFilter = organisationIds
            ? { organisationId: { in: organisationIds } }
            : {};

        const organisationCountFilter = organisationIds
            ? { id: { in: organisationIds } }
            : {};

        // Get total transactions with status breakdown
        const [totalTransactions, pendingCount, approvedCount, rejectedCount] = await Promise.all([
            prisma.transaction.count({
                where: { ...dateFilter, ...transactionDeptFilter }
            }),
            prisma.transaction.count({
                where: { ...dateFilter, ...transactionDeptFilter, status: 'PENDING' }
            }),
            prisma.transaction.count({
                where: { ...dateFilter, ...transactionDeptFilter, status: 'APPROVED' }
            }),
            prisma.transaction.count({
                where: { ...dateFilter, ...transactionDeptFilter, status: 'REJECTED' }
            }),
        ]);

        // Get income and expense totals (approved only for actual cash position)
        const approvedTransactions = await prisma.transaction.groupBy({
            by: ['type'],
            where: {
                ...dateFilter,
                ...transactionDeptFilter,
                status: 'APPROVED'
            },
            _sum: {
                amountInBase: true
            }
        });

        const totalIncome = approvedTransactions.find((t: { type: string }) => t.type === 'INCOME')?._sum.amountInBase || 0;
        const totalExpense = approvedTransactions.find((t: { type: string }) => t.type === 'EXPENSE')?._sum.amountInBase || 0;
        const netCashFlow = Number(totalIncome) - Number(totalExpense);

        // Get approval metrics
        const approvedTransactionsWithTime = await prisma.transaction.findMany({
            where: {
                ...dateFilter,
                ...transactionDeptFilter,
                status: 'APPROVED',
                approvedAt: { not: null }
            },
            select: {
                createdAt: true,
                approvedAt: true
            }
        });

        const approvalTimes = approvedTransactionsWithTime.map((t: { createdAt: Date; approvedAt: Date | null }) => {
            const created = new Date(t.createdAt).getTime();
            const approved = t.approvedAt ? new Date(t.approvedAt).getTime() : created;
            return (approved - created) / (1000 * 60 * 60); // hours
        });

        const avgApprovalTime = approvalTimes.length > 0
            ? approvalTimes.reduce((sum: number, time: number) => sum + time, 0) / approvalTimes.length
            : 0;

        const approvalRate = totalTransactions > 0
            ? (approvedCount / totalTransactions) * 100
            : 0;

        // Get active organisations and users count
        const [activeOrganisations, activeUsers] = await Promise.all([
            prisma.organisation.count({
                where: { isActive: true, ...organisationCountFilter }
            }),
            prisma.user.count({
                where: { archived: false, ...userDeptFilter }
            })
        ]);

        // Get monthly trend data (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyData = await prisma.$queryRaw<Array<{
            month: string;
            income: number;
            expense: number;
        }>>`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
                SUM(CASE WHEN type = 'INCOME' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as income,
                SUM(CASE WHEN type = 'EXPENSE' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as expense
            FROM "Transaction"
            WHERE "createdAt" >= ${twelveMonthsAgo}
            ${organisationIds ? Prisma.sql`AND "organisationId" IN (${Prisma.join(organisationIds)})` : Prisma.empty}
            GROUP BY month
            ORDER BY month ASC
        `;

        // Format monthly data
        const formattedMonthlyData = monthlyData.map((row: { month: string; income: number; expense: number }) => ({
            month: row.month,
            income: Number(row.income),
            expense: Number(row.expense),
            net: Number(row.income) - Number(row.expense)
        }));

        return NextResponse.json({
            overview: {
                totalIncome: Number(totalIncome),
                totalExpense: Number(totalExpense),
                netCashFlow,
                totalTransactions,
                pendingCount,
                approvedCount,
                rejectedCount,
                approvalRate: Math.round(approvalRate * 100) / 100,
                avgApprovalTime: Math.round(avgApprovalTime * 100) / 100,
                activeOrganisations,
                activeUsers
            },
            monthlyTrend: formattedMonthlyData
        });

    } catch (error) {
        console.error('Analytics overview error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics data' },
            { status: 500 }
        );
    }
}

// Helper function to get all sub-organisations recursively
async function getAllSubOrganisations(organisationId: string): Promise<string[]> {
    const children = await prisma.organisation.findMany({
        where: { parentId: organisationId },
        select: { id: true }
    });

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c: { id: string }) => c.id);
    const subChildren = await Promise.all(
        childIds.map((id: string) => getAllSubOrganisations(id))
    );

    return [...childIds, ...subChildren.flat()];
}
