import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        let whereClause: any = {};

        // Determine which department to use for filtering
        // For users with multiple roles, use the activeUserRole's department
        let filterDepartmentId = session.user.departmentId;
        
        if (session.user.activeUserRole?.departmentId) {
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'GLOBAL_ADMIN') {
            if (!filterDepartmentId) {
                return new NextResponse('Forbidden - No department assigned', { status: 403 });
            }
            const allowedIds = await getDescendantDepartmentIds(filterDepartmentId);
            whereClause.departmentId = { in: allowedIds };
        }

        // Get current week date range
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        // Calculate the last 4 ISO weeks using date-fns subWeeks for proper handling
        const weekRanges: { weekNumber: number; year: number }[] = [];
        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i);
            weekRanges.push({
                weekNumber: getISOWeek(weekDate),
                year: getISOWeekYear(weekDate),
            });
        }

        // Fetch all data in parallel for better performance
        const [
            userBaseCurrency,
            exchangeRates,
            incomeTransactions,
            expenseTransactions,
            weeklyIncomeTransactions,
            last4WeeksIncomeTransactions,
            last4WeeksExpenseTransactions,
        ] = await Promise.all([
            getUserBaseCurrency(session.user.id),
            prisma.exchangeRate.findMany({
                include: {
                    fromCurrency: true,
                    toCurrency: true,
                },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                },
                select: {
                    amount: true,
                    currencyId: true,
                },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED',
                },
                select: {
                    amount: true,
                    currencyId: true,
                },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    createdAt: {
                        gte: startOfWeek,
                        lt: endOfWeek,
                    },
                },
                select: {
                    amount: true,
                    currencyId: true,
                },
            }),
            // Get all income transactions from the last ~5 weeks for the chart
            // (5 weeks to ensure we capture all transactions in the 4 ISO weeks we display)
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    createdAt: {
                        gte: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // ~5 weeks ago
                    },
                },
                select: {
                    amount: true,
                    currencyId: true,
                    createdAt: true,
                },
            }),
            // Get all expense transactions from the last ~5 weeks for the chart
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED',
                    createdAt: {
                        gte: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // ~5 weeks ago
                    },
                },
                select: {
                    amount: true,
                    currencyId: true,
                    createdAt: true,
                },
            }),
        ]);
        
        if (!userBaseCurrency) {
            return new NextResponse('Base currency not configured', { status: 500 });
        }

        // Convert each transaction to user's base currency
        let totalIncome = 0;
        for (const tx of incomeTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const converted = await convertToUserBaseCurrency(
                Number(tx.amount),
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            totalIncome += converted;
        }

        let totalExpense = 0;
        for (const tx of expenseTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const converted = await convertToUserBaseCurrency(
                Number(tx.amount),
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            totalExpense += converted;
        }

        let weeklyIncome = 0;
        for (const tx of weeklyIncomeTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const converted = await convertToUserBaseCurrency(
                Number(tx.amount),
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            weeklyIncome += converted;
        }

        // Process weekly chart data - calculate income and expense for each of the last 4 weeks
        // Match transactions by ISO week number instead of date ranges
        const weeklyChartData = await Promise.all(
            weekRanges.map(async (week) => {
                let weekIncomeTotal = 0;
                let weekExpenseTotal = 0;

                for (const tx of last4WeeksIncomeTransactions) {
                    const txDate = new Date(tx.createdAt);
                    const txWeek = getISOWeek(txDate);
                    const txYear = getISOWeekYear(txDate);
                    
                    // Match by ISO week number and year
                    if (txWeek === week.weekNumber && txYear === week.year) {
                        const currencyId = tx.currencyId || userBaseCurrency.id;
                        const converted = await convertToUserBaseCurrency(
                            Number(tx.amount),
                            currencyId,
                            userBaseCurrency.id,
                            exchangeRates
                        );
                        weekIncomeTotal += converted;
                    }
                }

                for (const tx of last4WeeksExpenseTransactions) {
                    const txDate = new Date(tx.createdAt);
                    const txWeek = getISOWeek(txDate);
                    const txYear = getISOWeekYear(txDate);
                    
                    // Match by ISO week number and year
                    if (txWeek === week.weekNumber && txYear === week.year) {
                        const currencyId = tx.currencyId || userBaseCurrency.id;
                        const converted = await convertToUserBaseCurrency(
                            Number(tx.amount),
                            currencyId,
                            userBaseCurrency.id,
                            exchangeRates
                        );
                        weekExpenseTotal += converted;
                    }
                }

                return {
                    week: `W${week.weekNumber} '${String(week.year).slice(-2)}`,
                    income: weekIncomeTotal,
                    expense: weekExpenseTotal,
                };
            })
        );

        // Chart data is already in chronological order (oldest to newest, left to right)
        // Latest week appears on the right side of the chart
        const chartData = weeklyChartData;

        const netBalance = totalIncome - totalExpense;

        return NextResponse.json(
            {
                income: totalIncome,
                expense: totalExpense,
                balance: netBalance,
                weeklyIncome: weeklyIncome,
                chartData: chartData,
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
                },
            }
        );
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
