import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DepartmentLevel } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds, hasDepartmentAccess } from '@/lib/departments';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { toDecimal, moneyToString, type Money } from '@/lib/money';
import { Prisma } from '@prisma/client';

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

        // Verify department access for non-superadmins
        if (session.user.role !== 'SUPERADMIN') {
            const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;
            const hasAccess = await hasDepartmentAccess(
                { role: session.user.role, departmentId: filterDepartmentId },
                id
            );
            if (!hasAccess) {
                return new NextResponse('Forbidden', { status: 403 });
            }
        }

        // Get the department to determine its level
        const department = await prisma.department.findUnique({
            where: { id },
            select: { level: true },
        });

        if (!department) {
            return new NextResponse('Department not found', { status: 404 });
        }

        // Get the appropriate base currency for this department
        let baseCurrency;
        
        if (department.level === 'DENOMINATION') {
            // Denomination level uses system base currency (USD)
            baseCurrency = await prisma.currency.findFirst({
                where: { isBase: true },
            });
        } else {
            // Find the Oversight department for this department hierarchy
            let currentDeptId: string | null = id;
            let oversightDept = null;

            while (currentDeptId) {
                const dept: { level: DepartmentLevel | null; parentId: string | null } | null = await prisma.department.findUnique({
                    where: { id: currentDeptId },
                    select: { level: true, parentId: true },
                });

                if (!dept) break;

                if (dept.level === 'OVERSIGHT') {
                    oversightDept = await prisma.department.findUnique({
                        where: { id: currentDeptId },
                    });
                    break;
                }

                currentDeptId = dept.parentId || null;
            }

            if (oversightDept) {
                // Get the base currency for this oversight department
                const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
                    where: { departmentId: oversightDept.id },
                    include: { currency: true },
                });

                baseCurrency = deptBaseCurrency?.currency;
            }

            // Fallback to system base currency if no department base currency is set
            if (!baseCurrency) {
                baseCurrency = await prisma.currency.findFirst({
                    where: { isBase: true },
                });
            }
        }

        // Check if we should only get transactions at the exact department level
        const { searchParams } = new URL(request.url);
        const exactLevel = searchParams.get('exactLevel') === 'true';

        // Get all transactions for this department (and optionally its descendants)
        let departmentIds: string[];
        if (exactLevel) {
            // Only transactions directly on this department, not from child departments
            departmentIds = [id];
        } else {
            departmentIds = await getDescendantDepartmentIds(id);
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                departmentId: {
                    in: departmentIds,
                },
                status: 'APPROVED',
            },
            include: {
                currency: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Get all exchange rates for conversion
        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Calculate stats with Decimal arithmetic (exact, no float drift).
        const D = Prisma.Decimal;
        let income: Money = new D(0);
        let expense: Money = new D(0);
        let weeklyIncome: Money = new D(0);

        // Initialize weekly chart data using date-fns for proper week calculation
        // Support pagination: chartOffset=0 is current 4 weeks, chartOffset=1 is previous 4 weeks, etc.
        const chartOffset = Math.max(0, parseInt(searchParams.get('chartOffset') || '0', 10) || 0);
        const weeksBack = chartOffset * 4;

        const chartData: { week: string; weekNum: number; year: number; income: Money; expense: Money }[] = [];
        const now = new Date();

        // Use subWeeks to properly calculate weeks going back (handles year boundaries correctly)
        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i + weeksBack);
            const weekNum = getISOWeek(weekDate);
            const weekYear = getISOWeekYear(weekDate);

            chartData.push({
                week: `W${weekNum} '${String(weekYear).slice(-2)}`,
                weekNum: weekNum,
                year: weekYear,
                income: new D(0),
                expense: new D(0),
            });
        }

        for (const t of transactions) {
            let convertedAmount = toDecimal(t.amount);

            // If transaction has a currency different from department base, convert it
            if (t.currencyId && baseCurrency && t.currencyId !== baseCurrency.id) {
                let rate = exchangeRates.find(
                    (r) => r.fromCurrency.id === t.currencyId && r.toCurrency.id === baseCurrency.id
                );

                if (rate) {
                    convertedAmount = convertedAmount.mul(toDecimal(rate.rate));
                } else {
                    rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === baseCurrency.id && r.toCurrency.id === t.currencyId
                    );
                    if (rate) {
                        convertedAmount = convertedAmount.div(toDecimal(rate.rate));
                    }
                }
            }

            if (t.type === 'INCOME') {
                income = income.plus(convertedAmount);
                const currentWeekNum = getISOWeek(now);
                const currentYear = getISOWeekYear(now);
                if ((t as any).weekNumber === currentWeekNum && (t as any).year === currentYear) {
                    weeklyIncome = weeklyIncome.plus(convertedAmount);
                }
            } else if (t.type === 'EXPENSE') {
                expense = expense.plus(convertedAmount);
            }

            const txWeek = (t as any).weekNumber;
            const txYear = (t as any).year;

            if (txWeek && txYear) {
                for (let i = 0; i < 4; i++) {
                    if (chartData[i].weekNum === txWeek && chartData[i].year === txYear) {
                        if (t.type === 'INCOME') {
                            chartData[i].income = chartData[i].income.plus(convertedAmount);
                        } else if (t.type === 'EXPENSE') {
                            chartData[i].expense = chartData[i].expense.plus(convertedAmount);
                        }
                        break;
                    }
                }
            }
        }

        const balance = income.minus(expense);

        // Return chart data as exact strings so the client renders precise figures.
        const cleanChartData = chartData.map(({ week, income, expense }) => ({
            week,
            income: moneyToString(income),
            expense: moneyToString(expense),
        }));

        return NextResponse.json({
            income: moneyToString(income),
            expense: moneyToString(expense),
            balance: moneyToString(balance),
            weeklyIncome: moneyToString(weeklyIncome),
            chartData: cleanChartData,
            currency: baseCurrency ? {
                code: baseCurrency.code,
                symbol: baseCurrency.symbol,
            } : {
                code: 'GHS',
                symbol: '₵',
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
