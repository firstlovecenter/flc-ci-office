import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';

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

        // Get user's base currency
        const userBaseCurrency = await getUserBaseCurrency(session.user.id);
        
        if (!userBaseCurrency) {
            return new NextResponse('Base currency not configured', { status: 500 });
        }

        // Get all exchange rates for conversion
        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Get all transactions (we need to convert each one)
        const [incomeTransactions, expenseTransactions] = await Promise.all([
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
        ]);

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

        const netBalance = totalIncome - totalExpense;

        return NextResponse.json({
            income: totalIncome,
            expense: totalExpense,
            balance: netBalance,
        });
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
