import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek } from '@/lib/utils';

export async function GET(request: Request) {
    // Verify authorization (you might want to add a secret key check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
                    {
                        year: year,
                        weekNumber: { lt: weekNumber },
                    },
                ],
            },
            data: {
                locked: true,
            },
        });

        return NextResponse.json({
            success: true,
            lockedCount: result.count,
            currentWeek: weekNumber,
            currentYear: year,
        });
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
