import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DepartmentLevel } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';

// Helper function to get start and end of current week (Monday to Sunday)
function getCurrentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 6 = Saturday
    // Calculate days to subtract to get to Monday
    // If Monday (1-6): subtract (dayOfWeek - 1)
    // If Sunday (0): subtract 6 (go back to previous Monday)
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // 6 days later = Sunday
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

        // Get all transactions for this department and its descendants
        const descendantIds = await getDescendantDepartmentIds(id);

        const transactions = await prisma.transaction.findMany({
            where: {
                departmentId: {
                    in: descendantIds,
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

        // Calculate stats by converting each transaction to the department's base currency
        let income = 0;
        let expense = 0;
        let weeklyIncome = 0;
        const currentWeek = getCurrentWeekRange();

        // Initialize weekly chart data (last 4 weeks) using date-fns for proper week calculation
        const chartData: { week: string; weekNum: number; year: number; income: number; expense: number }[] = [];
        const now = new Date();
        
        // Use subWeeks to properly calculate weeks going back (handles year boundaries correctly)
        for (let i = 3; i >= 0; i--) {
            const weekDate = subWeeks(now, i);
            const weekNum = getISOWeek(weekDate);
            const weekYear = getISOWeekYear(weekDate);
            
            chartData.push({ 
                week: `W${weekNum} '${String(weekYear).slice(-2)}`, 
                weekNum: weekNum,
                year: weekYear,
                income: 0, 
                expense: 0 
            });
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

            // Add to chart data using ISO week numbers from date-fns
            const txDate = new Date(t.createdAt);
            const txWeek = getISOWeek(txDate);
            const txYear = getISOWeekYear(txDate);
            
            // Find matching chart bucket
            for (let i = 0; i < 4; i++) {
                if (chartData[i].weekNum === txWeek && chartData[i].year === txYear) {
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

        // Return chart data without internal weekNum/year fields
        const cleanChartData = chartData.map(({ week, income, expense }) => ({ week, income, expense }));

        return NextResponse.json({
            income,
            expense,
            balance,
            weeklyIncome,
            chartData: cleanChartData,
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
