import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        let whereClause: any = {};

        if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'GLOBAL_ADMIN') {
            if (!session.user.departmentId) {
                return new NextResponse('Forbidden - No department assigned', { status: 403 });
            }
            const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);
            whereClause.departmentId = { in: allowedIds };
        }

        // Get current week date range
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        // Calculate week numbers and date ranges for the last 4 weeks
        const getWeekNumber = (date: Date) => {
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
            return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        };

        const weekRanges = [];
        for (let i = 0; i < 4; i++) {
            const weekStart = new Date(startOfWeek);
            weekStart.setDate(startOfWeek.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            weekRanges.push({
                weekNumber: getWeekNumber(weekStart),
                start: weekStart,
                end: weekEnd,
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
            // Get all income transactions from the last 4 weeks for the chart
            // Get all income transactions from the last 4 weeks for the chart
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    createdAt: {
                        gte: weekRanges[3].start, // Oldest week start
                        lt: weekRanges[0].end, // Current week end
                    },
                },
                select: {
                    amount: true,
                    currencyId: true,
                    createdAt: true,
                },
            }),
            // Get all expense transactions from the last 4 weeks for the chart
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED',
                    createdAt: {
                        gte: weekRanges[3].start, // Oldest week start
                        lt: weekRanges[0].end, // Current week end
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
        const weeklyChartData = await Promise.all(
            weekRanges.map(async (week) => {
                let weekIncomeTotal = 0;
                let weekExpenseTotal = 0;

                for (const tx of last4WeeksIncomeTransactions) {
                    const txDate = new Date(tx.createdAt);
                    if (txDate >= week.start && txDate < week.end) {
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
                    if (txDate >= week.start && txDate < week.end) {
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
                    week: `Week ${week.weekNumber}`,
                    income: weekIncomeTotal,
                    expense: weekExpenseTotal,
                };
            })
        );

        // Reverse to show oldest first (left to right on chart)
        const chartData = weeklyChartData.reverse();

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
