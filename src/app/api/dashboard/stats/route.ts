import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { Prisma } from '@prisma/client';
import { moneyToString, type Money } from '@/lib/money';

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
                         success: false, // Only count failed critical operations, not intentional ones like impersonation
                         timestamp: { gte: today }
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

        const D = Prisma.Decimal;
        // Convert each transaction to user's base currency (Decimal arithmetic)
        let totalIncome: Money = new D(0);
        for (const tx of incomeTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            totalIncome = totalIncome.plus(convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            ));
        }

        let totalExpense: Money = new D(0);
        for (const tx of expenseTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            totalExpense = totalExpense.plus(convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            ));
        }

        let weeklyIncome: Money = new D(0);
        for (const tx of weeklyIncomeTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            weeklyIncome = weeklyIncome.plus(convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            ));
        }

        const chartData = weekRanges.map((week) => {
            let weekIncomeTotal: Money = new D(0);
            let weekExpenseTotal: Money = new D(0);

            for (const tx of last4WeeksIncomeTransactions) {
                if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
                    const currencyId = tx.currencyId || userBaseCurrency.id;
                    weekIncomeTotal = weekIncomeTotal.plus(convertToUserBaseCurrency(
                        tx.amount as any, currencyId, userBaseCurrency.id, exchangeRates
                    ));
                }
            }

            for (const tx of last4WeeksExpenseTransactions) {
                if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
                    const currencyId = tx.currencyId || userBaseCurrency.id;
                    weekExpenseTotal = weekExpenseTotal.plus(convertToUserBaseCurrency(
                        tx.amount as any, currencyId, userBaseCurrency.id, exchangeRates
                    ));
                }
            }

            return {
                week: `W${week.weekNumber} '${String(week.year).slice(-2)}`,
                income: moneyToString(weekIncomeTotal),
                expense: moneyToString(weekExpenseTotal),
            };
        });

        const netBalance = totalIncome.minus(totalExpense);

        return NextResponse.json(
            {
                income: moneyToString(totalIncome),
                expense: moneyToString(totalExpense),
                balance: moneyToString(netBalance),
                weeklyIncome: moneyToString(weeklyIncome),
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
