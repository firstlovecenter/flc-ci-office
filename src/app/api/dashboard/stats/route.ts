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
        // Special stats for Superadmin
        if (session.user.role === 'SUPERADMIN') {
             const today = new Date();
             today.setHours(0, 0, 0, 0);

             const [
                 userCount, 
                 departmentCount, 
                 transactionCount, 
                 pendingCount,
                 activeDepartmentCount,
                 activeCurrencyCount,
                 todaysLoginCount,
                 criticalErrorCount
             ] = await Promise.all([
                 prisma.user.count({ where: { archived: false } }),
                 prisma.department.count(),
                 prisma.transaction.count(),
                 prisma.transaction.count({ where: { status: 'PENDING' } }),
                 prisma.department.count({ where: { isActive: true } }),
                 prisma.currency.count({ where: { isActive: true } }),
                 prisma.auditLog.count({ 
                     where: { 
                         actionType: 'LOGIN',
                         timestamp: { gte: today }
                     } 
                 }),
                 prisma.auditLog.count({
                     where: {
                         severity: 'CRITICAL',
                         timestamp: { gte: today } // Critical errors today
                     }
                 })
             ]);

             return NextResponse.json({
                 superAdminStats: {
                     users: userCount,
                     departments: departmentCount,
                     transactions: transactionCount,
                     pendingApprovals: pendingCount,
                     activeDepartments: activeDepartmentCount,
                     activeCurrencies: activeCurrencyCount,
                     todaysLogins: todaysLoginCount,
                     criticalErrors: criticalErrorCount
                 }
             });
        }

        let whereClause: any = {};

        // Determine which department to use for filtering
        // For users with multiple roles, use the activeUserRole's department
        let filterDepartmentId = session.user.departmentId;
        
        if (session.user.activeUserRole?.departmentId) {
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'DENOMINATION_ADMIN') {
            if (!filterDepartmentId) {
                return new NextResponse('Forbidden - No department assigned', { status: 403 });
            }
            const allowedIds = await getDescendantDepartmentIds(filterDepartmentId);
            whereClause.departmentId = { in: allowedIds };
        }

        // Get current week date range (Monday to Sunday)
        const now = new Date();
        const currentWeekNumber = getISOWeek(now);
        const currentWeekYear = getISOWeekYear(now);

        // Support pagination: chartOffset=0 is current 4 weeks, chartOffset=1 is previous 4 weeks, etc.
        const { searchParams } = new URL(request.url);
        const chartOffset = Math.max(0, parseInt(searchParams.get('chartOffset') || '0', 10) || 0);
        const weeksBack = chartOffset * 4; // How many additional weeks to go back

        // Calculate the 4 ISO weeks for the requested page
        const weekRanges: { weekNumber: number; year: number }[] = [];
        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i + weeksBack);
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
            // Get this week's income using weekNumber/year fields
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    weekNumber: currentWeekNumber,
                    year: currentWeekYear,
                },
                select: {
                    amount: true,
                    currencyId: true,
                },
            }),
            // Get income transactions for the chart period
            // Filter by weekNumber/year directly for accurate matching
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    OR: weekRanges.map(w => ({ weekNumber: w.weekNumber, year: w.year })),
                },
                select: {
                    amount: true,
                    currencyId: true,
                    weekNumber: true,
                    year: true,
                },
            }),
            // Get expense transactions for the chart period
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED',
                    OR: weekRanges.map(w => ({ weekNumber: w.weekNumber, year: w.year })),
                },
                select: {
                    amount: true,
                    currencyId: true,
                    weekNumber: true,
                    year: true,
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

        // Process weekly chart data - calculate income and expense for each of the 4 weeks
        // Match transactions by their weekNumber/year fields directly
        const weeklyChartData = await Promise.all(
            weekRanges.map(async (week) => {
                let weekIncomeTotal = 0;
                let weekExpenseTotal = 0;

                for (const tx of last4WeeksIncomeTransactions) {
                    if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
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
                    if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
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
                    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
