import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';

// Helper function to get week number
function getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

// Helper function to get start and end of current week (Sunday to Saturday)
function getCurrentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

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
        
        if (department.level === 'GLOBAL') {
            // Global level uses system base currency (USD)
            baseCurrency = await prisma.currency.findFirst({
                where: { isBase: true },
            });
        } else {
            // Find the National department for this department hierarchy
            let currentDeptId: string | null = id;
            let nationalDept = null;

            while (currentDeptId) {
                const dept: { level: string; parentId: string | null } | null = await prisma.department.findUnique({
                    where: { id: currentDeptId },
                    select: { level: true, parentId: true },
                });

                if (!dept) break;

                if (dept.level === 'NATIONAL') {
                    nationalDept = await prisma.department.findUnique({
                        where: { id: currentDeptId },
                    });
                    break;
                }

                currentDeptId = dept.parentId || null;
            }

            if (nationalDept) {
                // Get the base currency for this national department
                const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
                    where: { departmentId: nationalDept.id },
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

        // Get all transactions for this department and its descendants
        const descendantIds = await getDescendantDepartmentIds(id);

        const transactions = await prisma.transaction.findMany({
            where: {
                departmentId: {
                    in: descendantIds,
                },
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

        // Calculate stats by converting each transaction to the department's base currency
        let income = 0;
        let expense = 0;
        let weeklyIncome = 0;
        const currentWeek = getCurrentWeekRange();

        // Initialize weekly chart data (last 4 weeks)
        const chartData: { week: string; income: number; expense: number }[] = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
            const weekNum = getWeekNumber(weekStart);
            chartData.push({ week: `Week ${weekNum}`, income: 0, expense: 0 });
        }

        for (const t of transactions) {
            let convertedAmount = Number(t.amount);

            // If transaction has a currency different from department base, convert it
            if (t.currencyId && baseCurrency && t.currencyId !== baseCurrency.id) {
                // Find exchange rate
                let rate = exchangeRates.find(
                    (r) => r.fromCurrency.id === t.currencyId && r.toCurrency.id === baseCurrency.id
                );

                if (rate) {
                    convertedAmount = Number(t.amount) * Number(rate.rate);
                } else {
                    // Try reverse rate
                    rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === baseCurrency.id && r.toCurrency.id === t.currencyId
                    );
                    if (rate) {
                        convertedAmount = Number(t.amount) / Number(rate.rate);
                    }
                }
            }

            if (t.type === 'INCOME') {
                income += convertedAmount;
                // Check if this week
                const txDate = new Date(t.createdAt);
                if (txDate >= currentWeek.start && txDate <= currentWeek.end) {
                    weeklyIncome += convertedAmount;
                }
            } else if (t.type === 'EXPENSE') {
                expense += convertedAmount;
            }

            // Add to chart data
            const txDate = new Date(t.createdAt);
            for (let i = 0; i < 4; i++) {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay() - ((3 - i) * 7));
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                if (txDate >= weekStart && txDate <= weekEnd) {
                    if (t.type === 'INCOME') {
                        chartData[i].income += convertedAmount;
                    } else if (t.type === 'EXPENSE') {
                        chartData[i].expense += convertedAmount;
                    }
                    break;
                }
            }
        }

        const balance = income - expense;

        return NextResponse.json({
            income,
            expense,
            balance,
            weeklyIncome,
            chartData,
            currency: baseCurrency ? {
                code: baseCurrency.code,
                symbol: baseCurrency.symbol,
            } : {
                code: 'GHS',
                symbol: '₵',
            },
        });
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
