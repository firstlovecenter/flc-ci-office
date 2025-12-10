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

        // Fetch all data in parallel for better performance
        const [userBaseCurrency, exchangeRates, incomeTransactions, expenseTransactions, weeklyIncomeTransactions] = await Promise.all([
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

        const netBalance = totalIncome - totalExpense;

        return NextResponse.json(
            {
                income: totalIncome,
                expense: totalExpense,
                balance: netBalance,
                weeklyIncome: weeklyIncome,
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
