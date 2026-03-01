import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentWeek } from '@/lib/utils';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { weekNumber, year } = getCurrentWeek();

        // Count unlocked past-week transactions
        const unlockedCount = await prisma.transaction.count({
            where: {
                locked: false,
                OR: [
                    { year: { lt: year } },
                    { year: year, weekNumber: { lt: weekNumber } },
                ],
            },
        });

        // Count already locked transactions
        const lockedCount = await prisma.transaction.count({
            where: { locked: true },
        });

        // Count current week transactions
        const currentWeekCount = await prisma.transaction.count({
            where: { weekNumber, year },
        });

        // Total transactions
        const totalCount = await prisma.transaction.count();

        return NextResponse.json({
            currentWeek: weekNumber,
            currentYear: year,
            unlockedPastWeek: unlockedCount,
            locked: lockedCount,
            currentWeekTransactions: currentWeekCount,
            total: totalCount,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch lock status' },
            { status: 500 }
        );
    }
}

export async function POST() {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { weekNumber, year } = getCurrentWeek();

        // Lock all transactions from previous weeks
        const result = await prisma.transaction.updateMany({
            where: {
                locked: false,
                OR: [
                    { year: { lt: year } },
                    { year: year, weekNumber: { lt: weekNumber } },
                ],
            },
            data: {
                locked: true,
            },
        });

        // Audit log
        await createAuditLog({
            userId: session.user.id,
            actionType: 'UPDATE',
            entityType: 'Transaction',
            entityId: 'bulk-lock',
            description: `Manually locked ${result.count} past-week transactions (before week ${weekNumber}, ${year})`,
            beforeData: null,
            afterData: { lockedCount: result.count, weekNumber, year },
            metadata: { action: 'manual-week-lock' },
            severity: 'HIGH',
        });

        return NextResponse.json({
            success: true,
            lockedCount: result.count,
            currentWeek: weekNumber,
            currentYear: year,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to lock transactions' },
            { status: 500 }
        );
    }
}
