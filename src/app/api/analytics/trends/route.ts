import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        const period = searchParams.get('period') || 'monthly'; // monthly, weekly, daily
        const departmentId = searchParams.get('departmentId');

        // Build department scope based on user role
        let scopeFilter = Prisma.empty;
        
        if (normalizedRole !== 'SUPERADMIN') {
            const userDept = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { department: true }
            });

            if (userDept?.departmentId) {
                const allSubDepts = await getAllSubDepartments(userDept.departmentId);
                const allowedIds = [userDept.departmentId, ...allSubDepts];
                scopeFilter = Prisma.sql`AND "departmentId" IN (${Prisma.join(allowedIds)})`;
            } else {
                // No department access -> return no data
                scopeFilter = Prisma.sql`AND 1=0`;
            }
        }

        // Build specific department filter
        const departmentFilter = departmentId
            ? Prisma.sql`AND "departmentId" = ${departmentId}`
            : Prisma.empty;

        // Combine filters
        const finalFilter = Prisma.sql`${scopeFilter} ${departmentFilter}`;

        let trendData;

        if (period === 'daily') {
            // Last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            trendData = await prisma.$queryRaw<Array<{
                date: string;
                income: number;
                expense: number;
                transactions: number;
            }>>`
                SELECT 
                    TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as date,
                    SUM(CASE WHEN type = 'INCOME' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'EXPENSE' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as expense,
                    COUNT(*) as transactions
                FROM "Transaction"
                WHERE "createdAt" >= ${thirtyDaysAgo}
                ${finalFilter}
                GROUP BY date
                ORDER BY date ASC
            `;
        } else if (period === 'weekly') {
            // Last 12 weeks
            const twelveWeeksAgo = new Date();
            twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - (12 * 7));

            trendData = await prisma.$queryRaw<Array<{
                week: string;
                income: number;
                expense: number;
                transactions: number;
            }>>`
                SELECT 
                    TO_CHAR(DATE_TRUNC('week', "createdAt"), 'YYYY-MM-DD') as week,
                    SUM(CASE WHEN type = 'INCOME' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'EXPENSE' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as expense,
                    COUNT(*) as transactions
                FROM "Transaction"
                WHERE "createdAt" >= ${twelveWeeksAgo}
                ${finalFilter}
                GROUP BY week
                ORDER BY week ASC
            `;
        } else {
            // Monthly - last 12 months
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

            trendData = await prisma.$queryRaw<Array<{
                month: string;
                income: number;
                expense: number;
                transactions: number;
            }>>`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
                    SUM(CASE WHEN type = 'INCOME' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'EXPENSE' AND status = 'APPROVED' THEN COALESCE("amountInBase", 0) ELSE 0 END) as expense,
                    COUNT(*) as transactions
                FROM "Transaction"
                WHERE "createdAt" >= ${twelveMonthsAgo}
                ${finalFilter}
                GROUP BY month
                ORDER BY month ASC
            `;
        }

        // Format the data
        const formattedData = trendData.map((row: any) => ({
            period: (row as any).date || (row as any).week || (row as any).month,
            income: Number(row.income),
            expense: Number(row.expense),
            net: Number(row.income) - Number(row.expense),
            transactions: Number(row.transactions),
            growth: 0 // Will calculate below
        }));

        // Calculate growth rates
        for (let i = 1; i < formattedData.length; i++) {
            const current = formattedData[i].income + formattedData[i].expense;
            const previous = formattedData[i - 1].income + formattedData[i - 1].expense;
            
            if (previous > 0) {
                formattedData[i].growth = ((current - previous) / previous) * 100;
            }
        }

        // Get currency distribution
        const currencyDistribution = await prisma.$queryRaw<Array<{
            currency_code: string;
            transaction_count: number;
            total_amount: number;
        }>>`
            SELECT 
                c.code as currency_code,
                COUNT(t.id) as transaction_count,
                SUM(CASE WHEN t.status = 'APPROVED' THEN COALESCE(t."amountInBase", 0) ELSE 0 END) as total_amount
            FROM "Transaction" t
            LEFT JOIN "Currency" c ON t."currencyId" = c.id
            WHERE t."currencyId" IS NOT NULL
            ${finalFilter}
            GROUP BY c.code
            ORDER BY transaction_count DESC
            LIMIT 10
        `;

        const formattedCurrencyDist = currencyDistribution.map((row: any) => ({
            currency: row.currency_code,
            count: Number(row.transaction_count),
            amount: Number(row.total_amount)
        }));

        // Get status distribution over time
        const statusTrend = await prisma.$queryRaw<Array<{
            month: string;
            pending: number;
            approved: number;
            rejected: number;
        }>>`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
            FROM "Transaction"
            WHERE "createdAt" >= ${new Date(new Date().setMonth(new Date().getMonth() - 12))}
            ${finalFilter}
            GROUP BY month
            ORDER BY month ASC
        `;

        const formattedStatusTrend = statusTrend.map((row: any) => ({
            month: row.month,
            pending: Number(row.pending),
            approved: Number(row.approved),
            rejected: Number(row.rejected)
        }));

        return NextResponse.json({
            trends: formattedData,
            currencyDistribution: formattedCurrencyDist,
            statusTrend: formattedStatusTrend
        });

    } catch (error) {
        console.error('Transaction trends error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transaction trends' },
            { status: 500 }
        );
    }
}

// Helper function to get all sub-departments recursively
async function getAllSubDepartments(departmentId: string): Promise<string[]> {
    const children = await prisma.department.findMany({
        where: { parentId: departmentId },
        select: { id: true }
    });

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c: { id: string }) => c.id);
    const subChildren = await Promise.all(
        childIds.map((id: string) => getAllSubDepartments(id))
    );

    return [...childIds, ...subChildren.flat()];
}
