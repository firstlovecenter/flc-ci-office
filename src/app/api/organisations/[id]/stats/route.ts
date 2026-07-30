import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantOrganisationIds, hasOrganisationAccess } from '@/lib/organisations';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { toDecimal, moneyToString, type Money } from '@/lib/money';
import { Prisma } from '@prisma/client';
import { getAppCurrency, APP_CURRENCY } from '@/lib/currency';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { id } = await params;

        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            const hasAccess = await hasOrganisationAccess(
                { role: session.user.role, organisationId: filterOrganisationId },
                id
            );
            if (!hasAccess) {
                return new NextResponse('Forbidden', { status: 403 });
            }
        }

        const organisation = await prisma.organisation.findUnique({
            where: { id },
            select: { level: true },
        });

        if (!organisation) {
            return new NextResponse('Church not found', { status: 404 });
        }

        const baseCurrency = await getAppCurrency();
        const { searchParams } = new URL(request.url);
        const exactLevel = searchParams.get('exactLevel') === 'true';

        const organisationIds = exactLevel
            ? [id]
            : await getDescendantOrganisationIds(id);

        const transactions = await prisma.transaction.findMany({
            where: {
                organisationId: { in: organisationIds },
                status: 'APPROVED',
            },
            orderBy: { createdAt: 'desc' },
        });

        const D = Prisma.Decimal;
        let income: Money = new D(0);
        let expense: Money = new D(0);
        let weeklyIncome: Money = new D(0);

        const chartOffset = Math.max(0, parseInt(searchParams.get('chartOffset') || '0', 10) || 0);
        const weeksBack = chartOffset * 4;
        const chartData: { week: string; weekNum: number; year: number; income: Money; expense: Money }[] = [];
        const now = new Date();

        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i + weeksBack);
            chartData.push({
                week: `W${getISOWeek(weekDate)} '${String(getISOWeekYear(weekDate)).slice(-2)}`,
                weekNum: getISOWeek(weekDate),
                year: getISOWeekYear(weekDate),
                income: new D(0),
                expense: new D(0),
            });
        }

        for (const t of transactions) {
            const amt = toDecimal(t.amountInBase ?? t.amount);

            if (t.type === 'INCOME') {
                income = income.plus(amt);
                if (t.weekNumber === getISOWeek(now) && t.year === getISOWeekYear(now)) {
                    weeklyIncome = weeklyIncome.plus(amt);
                }
            } else if (t.type === 'EXPENSE') {
                expense = expense.plus(amt);
            }

            if (t.weekNumber && t.year) {
                for (let i = 0; i < 4; i++) {
                    if (chartData[i].weekNum === t.weekNumber && chartData[i].year === t.year) {
                        if (t.type === 'INCOME') chartData[i].income = chartData[i].income.plus(amt);
                        else if (t.type === 'EXPENSE') chartData[i].expense = chartData[i].expense.plus(amt);
                        break;
                    }
                }
            }
        }

        return NextResponse.json({
            income: moneyToString(income),
            expense: moneyToString(expense),
            balance: moneyToString(income.minus(expense)),
            weeklyIncome: moneyToString(weeklyIncome),
            chartData: chartData.map(({ week, income: inc, expense: exp }) => ({
                week,
                income: moneyToString(inc),
                expense: moneyToString(exp),
            })),
            currency: {
                code: baseCurrency.code || APP_CURRENCY.code,
                symbol: baseCurrency.symbol || APP_CURRENCY.symbol,
            },
        }, {
            headers: {
                'Cache-Control': 'private, no-store, no-cache, must-revalidate',
            },
        });
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
