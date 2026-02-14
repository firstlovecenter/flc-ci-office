import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds, hasDepartmentAccess } from '@/lib/departments';

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

        // Get all descendant department IDs
        const descendantIds = await getDescendantDepartmentIds(id);

        // Count users in this department and descendants
        const usersCount = await prisma.user.count({
            where: {
                departmentId: {
                    in: descendantIds,
                },
            },
        });

        // Count immediate sub-departments
        const subDepartmentsCount = await prisma.department.count({
            where: {
                parentId: id,
            },
        });

        // Count transactions in this department and descendants
        const transactionsCount = await prisma.transaction.count({
            where: {
                departmentId: {
                    in: descendantIds,
                },
            },
        });

        // Get recent transactions
        const recentTransactions = await prisma.transaction.findMany({
            where: {
                departmentId: {
                    in: descendantIds,
                },
            },
            include: {
                department: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
        });

        return NextResponse.json({
            users: usersCount,
            subDepartments: subDepartmentsCount,
            transactions: transactionsCount,
            recentTransactions,
        });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
