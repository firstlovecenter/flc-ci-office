import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        let whereClause: any = {};

        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return new NextResponse('Forbidden', { status: 403 });
            }
            const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);
            whereClause.departmentId = { in: allowedIds };
        }

        const [income, expense] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    ...whereClause,
                    type: 'INCOME',
                    status: 'APPROVED', // Only count approved transactions
                },
                _sum: {
                    amount: true,
                },
            }),
            prisma.transaction.aggregate({
                where: {
                    ...whereClause,
                    type: 'EXPENSE',
                    status: 'APPROVED', // Only count approved transactions
                },
                _sum: {
                    amount: true,
                },
            }),
        ]);

        const totalIncome = Number(income._sum.amount || 0);
        const totalExpense = Number(expense._sum.amount || 0);
        const netBalance = totalIncome - totalExpense;

        return NextResponse.json({
            income: totalIncome,
            expense: totalExpense,
            balance: netBalance,
        });
    } catch (error) {
        console.error(error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
