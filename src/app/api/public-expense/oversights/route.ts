import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public endpoint — returns all active OVERSIGHT-level departments for the dropdown
export async function GET() {
    try {
        const oversights = await prisma.department.findMany({
            where: {
                level: 'OVERSIGHT',
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(oversights);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch oversight churches' }, { status: 500 });
    }
}
