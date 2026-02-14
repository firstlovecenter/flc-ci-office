import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const normalizedRole = (session.user.role || '').toUpperCase();
        // Check if user has analytics access (CAMPUS_ADMIN and above, including leaders)
        const hasAccess = [
            'SUPERADMIN',
            'DENOMINATION_ADMIN',
            'DENOMINATION_LEADER',
            'OVERSIGHT_ADMIN',
            'OVERSIGHT_LEADER',
            'CAMPUS_ADMIN',
            'CAMPUS_LEADER'
        ].includes(normalizedRole);

        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const limit = parseInt(searchParams.get('limit') || '10');
        const level = searchParams.get('level');

        // Build date filter
        const dateFilter = startDate && endDate ? {
            createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            }
        } : {};

        // Build level filter
        const levelFilter = level ? { level: level as any } : {};

        // Build department scope filter based on user role
        let allowedDepartmentIds: string[] | null = null;
        if (normalizedRole !== 'SUPERADMIN') {
            // Filter to user's department and below
            // Use activeUserRole if available, otherwise use user's base department
            const filterDepartmentId = session.user.activeUserRole?.departmentId || session.user.departmentId;

            if (filterDepartmentId) {
                const allSubDepts = await getAllSubDepartments(filterDepartmentId);
                allowedDepartmentIds = [filterDepartmentId, ...allSubDepts];
            } else {
                // User has no department but is not superadmin? Should probably see nothing.
                allowedDepartmentIds = []; 
            }
        }

        const scopeFilter = allowedDepartmentIds
            ? { id: { in: allowedDepartmentIds } }
            : {};

        // Get departments with transaction aggregates
        const departments = await prisma.department.findMany({
            where: {
                isActive: true,
                ...levelFilter,
                ...scopeFilter
            },
            include: {
                transactions: {
                    where: {
                        ...dateFilter,
                        status: 'APPROVED'
                    },
                    select: {
                        type: true,
                        amountInBase: true
                    }
                },
                _count: {
                    select: {
                        transactions: {
                            where: dateFilter
                        }
                    }
                }
            }
        });

        // Calculate metrics for each department
        const departmentMetrics = departments.map((dept: any) => {
            const income = dept.transactions
                .filter((t: any) => t.type === 'INCOME')
                .reduce((sum: number, t: any) => sum + Number(t.amountInBase || 0), 0);

            const expense = dept.transactions
                .filter((t: any) => t.type === 'EXPENSE')
                .reduce((sum: number, t: any) => sum + Number(t.amountInBase || 0), 0);

            const netFlow = income - expense;
            const transactionCount = dept._count.transactions;

            return {
                id: dept.id,
                name: dept.name,
                level: dept.level,
                income,
                expense,
                netFlow,
                transactionCount
            };
        });

        // Sort by total volume (income + expense) descending
        departmentMetrics.sort((a: any, b: any) => {
            const volumeA = a.income + a.expense;
            const volumeB = b.income + b.expense;
            return volumeB - volumeA;
        });

        // Take top N departments
        const topDepartments = departmentMetrics.slice(0, limit);

        // Get department hierarchy data for drill-down
        const hierarchyDateFilter = startDate && endDate
            ? Prisma.sql`AND t."createdAt" >= ${new Date(startDate)} AND t."createdAt" <= ${new Date(endDate)}`
            : Prisma.empty;

        const hierarchyData = await prisma.$queryRaw<Array<{
            level: string;
            count: number;
            total_income: number;
            total_expense: number;
        }>>`
            SELECT 
                d.level,
                COUNT(DISTINCT d.id) as count,
                SUM(CASE WHEN t.type = 'INCOME' AND t.status = 'APPROVED' THEN COALESCE(t."amountInBase", 0) ELSE 0 END) as total_income,
                SUM(CASE WHEN t.type = 'EXPENSE' AND t.status = 'APPROVED' THEN COALESCE(t."amountInBase", 0) ELSE 0 END) as total_expense
            FROM "Department" d
            LEFT JOIN "Transaction" t ON d.id = t."departmentId"
            WHERE d."isActive" = true
            ${hierarchyDateFilter}
            GROUP BY d.level
            ORDER BY 
                CASE d.level
                    WHEN 'DENOMINATION' THEN 1
                    WHEN 'OVERSIGHT' THEN 2
                    WHEN 'CAMPUS' THEN 3
                    WHEN 'STREAM' THEN 4
                    WHEN 'COUNCIL' THEN 5
                END
        `;

        const formattedHierarchy = hierarchyData.map((row: any) => ({
            level: row.level,
            count: Number(row.count),
            income: Number(row.total_income),
            expense: Number(row.total_expense),
            net: Number(row.total_income) - Number(row.total_expense)
        }));

        return NextResponse.json({
            departments: topDepartments,
            hierarchy: formattedHierarchy
        });

    } catch (error) {
        console.error('Department analytics error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch department analytics' },
            { status: 500 }
        );
    }
}

// Helper function to get all sub-departments recursively
async function getAllSubDepartments(departmentId: string): Promise<string[]> {
    const children = await prisma.department.findMany({
        where: { parentId: departmentId },
        select: { id: true }
    });

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c: { id: string }) => c.id);
    const subChildren = await Promise.all(
        childIds.map((id: string) => getAllSubDepartments(id))
    );

    return [...childIds, ...subChildren.flat()];
}
