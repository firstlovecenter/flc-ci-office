import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0; // Disable caching

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                department: {
                    include: {
                        parent: {
                            include: {
                                parent: {
                                    include: {
                                        parent: true,
                                    },
                                },
                            },
                        },
                    },
                },
                activeUserRole: {
                    include: {
                        department: {
                            include: {
                                parent: {
                                    include: {
                                        parent: {
                                            include: {
                                                parent: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                userRoles: {
                    include: {
                        department: {
                            include: {
                                parent: {
                                    include: {
                                        parent: {
                                            include: {
                                                parent: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Use the activeUserRole, or fall back to first userRole if no active role set
        let activeUserRole = user.activeUserRole;
        
        if (!activeUserRole && user.userRoles.length > 0) {
            // If no active role selected, prioritize SUPERADMIN or GLOBAL_ADMIN
            activeUserRole = user.userRoles.find(ur => ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(ur.role)) || user.userRoles[0];
        }

        const activeRole = activeUserRole?.role || user.activeRole || 'COUNCIL_LEADER';

        // For international level and above, use system base currency
        const highLevelRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'GLOBAL_LEADER', 'INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER'];
        const isHighLevel = highLevelRoles.includes(activeRole);
        
        if (isHighLevel) {
            const systemBaseCurrency = await prisma.currency.findFirst({
                where: { isBase: true },
            });
            return NextResponse.json({
                ...user,
                baseCurrency: systemBaseCurrency,
                activeUserRoleId: user.activeUserRoleId,
            });
        }

        // For national level and below, find the national department's base currency
        let nationalDept = activeUserRole?.department;
        
        // For national admin/leader, use their current department
        // For below national level, traverse up to find national department
        const regionalRoles = ['REGIONAL_ADMIN', 'REGIONAL_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const isRegional = regionalRoles.includes(activeRole);
        
        if (isRegional && nationalDept) {
            // Traverse up to find national department
            while (nationalDept && nationalDept.level !== 'NATIONAL' && nationalDept.parentId) {
                nationalDept = await prisma.department.findUnique({
                    where: { id: nationalDept.parentId },
                    include: {
                        parent: {
                            include: {
                                parent: {
                                    include: {
                                        parent: true,
                                    },
                                },
                            },
                        },
                    },
                }) || nationalDept;
            }
        }

        if (nationalDept && nationalDept.level === 'NATIONAL') {
            // Check if this national department has a base currency set
            const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
                where: { departmentId: nationalDept.id },
                include: { currency: true },
            });

            if (deptBaseCurrency) {
                return NextResponse.json({
                    ...user,
                    baseCurrency: deptBaseCurrency.currency,
                    activeUserRoleId: user.activeUserRoleId,
                });
            }
        }

        // Fallback to system base currency
        const systemBaseCurrency = await prisma.currency.findFirst({
            where: { isBase: true },
        });

        return NextResponse.json({
            ...user,
            baseCurrency: systemBaseCurrency,
            activeUserRoleId: user.activeUserRoleId,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { department: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Only national admins can set base currency for their department
        if (!user.roles || !user.roles.includes('NATIONAL_ADMIN')) {
            return NextResponse.json(
                { error: 'Only national admins can set base currency' },
                { status: 403 }
            );
        }

        if (!user.department || user.department.level !== 'NATIONAL') {
            return NextResponse.json(
                { error: 'User must be in a national-level department' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { baseCurrencyId } = body;

        // Get the old base currency (if any) before updating
        const oldDeptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
            where: { departmentId: user.department.id },
            include: { currency: true },
        });

        // Upsert the department base currency
        const deptBaseCurrency = await prisma.departmentBaseCurrency.upsert({
            where: { departmentId: user.department.id },
            create: {
                departmentId: user.department.id,
                currencyId: baseCurrencyId,
                setBy: user.id,
            },
            update: {
                currencyId: baseCurrencyId,
                setBy: user.id,
            },
            include: {
                currency: true,
            },
        });

        // If base currency changed, recalculate all transactions for this department and its children
        if (!oldDeptBaseCurrency || oldDeptBaseCurrency.currencyId !== baseCurrencyId) {
            // Get all exchange rates for conversion
            const exchangeRates = await prisma.exchangeRate.findMany({
                include: {
                    fromCurrency: true,
                    toCurrency: true,
                },
            });

            // Get all departments under this national department (including itself)
            const departmentIds = await prisma.$queryRaw<{ id: string }[]>`
                WITH RECURSIVE dept_tree AS (
                    SELECT id FROM "Department" WHERE id = ${user.department.id}
                    UNION ALL
                    SELECT d.id FROM "Department" d
                    INNER JOIN dept_tree dt ON d."parentId" = dt.id
                )
                SELECT id FROM dept_tree
            `;

            const deptIds = departmentIds.map(d => d.id);

            // Get all transactions for these departments
            const transactions = await prisma.transaction.findMany({
                where: { 
                    departmentId: { in: deptIds },
                    currencyId: { not: null } 
                },
                include: { currency: true },
            });

            // Recalculate each transaction
            for (const tx of transactions) {
                let newAmountInBase = Number(tx.amount);

                if (tx.currencyId === baseCurrencyId) {
                    // Transaction is in the new base currency - use original amount
                    newAmountInBase = Number(tx.amount);
                } else if (tx.currencyId) {
                    // Transaction is in a different currency - convert to new base
                    // Find exchange rate: transaction currency → new base currency
                    let rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === tx.currencyId && r.toCurrency.id === baseCurrencyId
                    );

                    if (rate) {
                        // Direct rate found: txCurrency → newBase
                        newAmountInBase = Number(tx.amount) * parseFloat(rate.rate.toString());
                    } else {
                        // Try reverse: newBase → txCurrency
                        rate = exchangeRates.find(
                            (r) => r.fromCurrency.id === baseCurrencyId && r.toCurrency.id === tx.currencyId
                        );
                        if (rate) {
                            // Invert the rate
                            newAmountInBase = Number(tx.amount) / parseFloat(rate.rate.toString());
                        }
                    }
                }

                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { amountInBase: newAmountInBase },
                });
            }
        }

        return NextResponse.json({
            ...user,
            baseCurrency: deptBaseCurrency.currency,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
