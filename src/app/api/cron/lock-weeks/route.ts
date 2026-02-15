import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek } from '@/lib/utils';

export async function POST(request: Request) {
    // Verify authorization with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
        console.error('CRON_SECRET environment variable is not set');
        return new NextResponse('Server configuration error', { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
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
