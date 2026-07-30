import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantOrganisationIds } from '@/lib/organisations';
import { getAppCurrency } from '@/lib/currency';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { Prisma } from '@prisma/client';
import { toDecimal, moneyToString, type Money } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        if (session.user.role === 'SUPERADMIN') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [
                userCount,
                organisationCount,
                transactionCount,
                pendingCount,
                activeOrganisationCount,
                todaysLoginCount,
                criticalErrorCount,
            ] = await Promise.all([
                prisma.user.count({ where: { archived: false } }),
                prisma.organisation.count(),
                prisma.transaction.count(),
                prisma.transaction.count({ where: { status: 'PENDING' } }),
                prisma.organisation.count({ where: { isActive: true } }),
                prisma.auditLog.count({
                    where: {
                        actionType: 'LOGIN',
                        timestamp: { gte: today },
                    },
                }),
                prisma.auditLog.count({
                    where: {
                        severity: 'CRITICAL',
                        success: false,
                        timestamp: { gte: today },
                    },
                }),
            ]);

            return NextResponse.json({
                superAdminStats: {
                    users: userCount,
                    organisations: organisationCount,
                    transactions: transactionCount,
                    pendingApprovals: pendingCount,
                    activeOrganisations: activeOrganisationCount,
                    activeCurrencies: 1,
                    todaysLogins: todaysLoginCount,
                    criticalErrors: criticalErrorCount,
                },
            });
        }

        let whereClause: any = {};
        let filterOrganisationId = session.user.organisationId;

        if (session.user.activeUserRole?.organisationId) {
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'DENOMINATION_ADMIN') {
            if (!filterOrganisationId) {
                return new NextResponse('Forbidden - No organisation assigned', { status: 403 });
            }
            const allowedIds = await getDescendantOrganisationIds(filterOrganisationId);
            whereClause.organisationId = { in: allowedIds };
        }

        const now = new Date();
        const currentWeekNumber = getISOWeek(now);
        const currentWeekYear = getISOWeekYear(now);

        const { searchParams } = new URL(request.url);
        const chartOffset = Math.max(0, parseInt(searchParams.get('chartOffset') || '0', 10) || 0);
        const weeksBack = chartOffset * 4;

        const weekRanges: { weekNumber: number; year: number }[] = [];
        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i + weeksBack);
            weekRanges.push({
                weekNumber: getISOWeek(weekDate),
                year: getISOWeekYear(weekDate),
            });
        }

        const [
            baseCurrency,
            incomeTransactions,
            expenseTransactions,
            weeklyIncomeTransactions,
            last4WeeksIncomeTransactions,
            last4WeeksExpenseTransactions,
        ] = await Promise.all([
            getAppCurrency(),
            prisma.transaction.findMany({
                where: { ...whereClause, type: 'INCOME', status: 'APPROVED' },
                select: { amount: true, amountInBase: true },
            }),
            prisma.transaction.findMany({
                where: { ...whereClause, type: 'EXPENSE', status: 'APPROVED' },
                select: { amount: true, amountInBase: true },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    weekNumber: currentWeekNumber,
                    year: currentWeekYear,
                },
                select: { amount: true, amountInBase: true },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED',
                    OR: weekRanges.map((w) => ({ weekNumber: w.weekNumber, year: w.year })),
                },
                select: { amount: true, amountInBase: true, weekNumber: true, year: true },
            }),
            prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED',
                    OR: weekRanges.map((w) => ({ weekNumber: w.weekNumber, year: w.year })),
                },
                select: { amount: true, amountInBase: true, weekNumber: true, year: true },
            }),
        ]);

        if (!baseCurrency) {
            return new NextResponse('Base currency not configured', { status: 500 });
        }

        const D = Prisma.Decimal;
        const sumTx = (txs: { amount: any; amountInBase: any }[]) => {
            let total: Money = new D(0);
            for (const tx of txs) {
                total = total.plus(toDecimal(tx.amountInBase ?? tx.amount));
            }
            return total;
        };

        const totalIncome = sumTx(incomeTransactions);
        const totalExpense = sumTx(expenseTransactions);
        const weeklyIncome = sumTx(weeklyIncomeTransactions);

        const chartData = weekRanges.map((week) => {
            let weekIncomeTotal: Money = new D(0);
            let weekExpenseTotal: Money = new D(0);

            for (const tx of last4WeeksIncomeTransactions) {
                if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
                    weekIncomeTotal = weekIncomeTotal.plus(toDecimal(tx.amountInBase ?? tx.amount));
                }
            }

            for (const tx of last4WeeksExpenseTransactions) {
                if (tx.weekNumber === week.weekNumber && tx.year === week.year) {
                    weekExpenseTotal = weekExpenseTotal.plus(toDecimal(tx.amountInBase ?? tx.amount));
                }
            }

            return {
                week: `W${week.weekNumber} '${String(week.year).slice(-2)}`,
                income: moneyToString(weekIncomeTotal),
                expense: moneyToString(weekExpenseTotal),
            };
        });

        return NextResponse.json(
            {
                income: moneyToString(totalIncome),
                expense: moneyToString(totalExpense),
                balance: moneyToString(totalIncome.minus(totalExpense)),
                weeklyIncome: moneyToString(weeklyIncome),
                chartData,
                currency: { code: baseCurrency.code, symbol: baseCurrency.symbol },
            },
            {
                headers: {
                    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
                },
            },
        );
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
