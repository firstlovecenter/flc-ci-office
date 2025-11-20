import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDescendantDepartmentIds } from '@/lib/departments';

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

        // Get all transactions for this department and its descendants
        const descendantIds = await getDescendantDepartmentIds(id);

        const transactions = await prisma.transaction.findMany({
            where: {
                departmentId: {
                    in: descendantIds,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Calculate stats
        const income = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const expense = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const balance = income - expense;

        return NextResponse.json({
            income,
            expense,
            balance,
        });
    } catch (error) {
        console.error('Error fetching department stats:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
