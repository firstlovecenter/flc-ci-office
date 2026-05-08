import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { Prisma } from '@prisma/client';
import { moneyToString, type Money } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get('departmentId');
        const exactDepartment = searchParams.get('exactDepartment') === 'true';

        const whereClause: any = { status: 'APPROVED' };

        let filterDepartmentId = session.user.departmentId;
        if (session.user.activeUserRole?.departmentId) {
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        const isGlobalRole = session.user.role === 'SUPERADMIN' || session.user.role === 'DENOMINATION_ADMIN';

        if (!isGlobalRole) {
            if (!filterDepartmentId) {
                return new NextResponse('Forbidden - No department assigned', { status: 403 });
            }

            const allowedIds = await getDescendantDepartmentIds(filterDepartmentId);

            if (departmentId) {
                if (!allowedIds.includes(departmentId)) {
                    return new NextResponse('Forbidden', { status: 403 });
                }

                if (exactDepartment) {
                    whereClause.departmentId = departmentId;
                } else {
                    const descendantIds = await getDescendantDepartmentIds(departmentId);
                    whereClause.departmentId = { in: descendantIds };
                }
            } else {
                whereClause.departmentId = { in: allowedIds };
            }
        } else if (departmentId) {
            if (exactDepartment) {
                whereClause.departmentId = departmentId;
            } else {
                const descendantIds = await getDescendantDepartmentIds(departmentId);
                whereClause.departmentId = { in: descendantIds };
            }
        }

        const [userBaseCurrency, exchangeRates, incomeTransactions, expenseTransactions] = await Promise.all([
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

        const D = Prisma.Decimal;
        let totalIncome: Money = new D(0);
        for (const tx of incomeTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const converted = convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            totalIncome = totalIncome.plus(converted);
        }

        let totalExpense: Money = new D(0);
        for (const tx of expenseTransactions) {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const converted = convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            totalExpense = totalExpense.plus(converted);
        }

        return NextResponse.json(
            {
                income: moneyToString(totalIncome),
                expense: moneyToString(totalExpense),
                balance: moneyToString(totalIncome.minus(totalExpense)),
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