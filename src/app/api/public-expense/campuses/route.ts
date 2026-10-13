import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public endpoint — returns active campuses with the public form enabled, and
// each campus's submission window so the form can say when it is open.
export async function GET() {
    try {
        const campuses = await prisma.organisation.findMany({
            where: {
                level: 'CAMPUS',
                isActive: true,
                publicFormEnabled: true,
            },
            select: {
                id: true,
                name: true,
                parent: { select: { name: true } },
                expenseWindowOpenMinutes: true,
                expenseWindowCloseMinutes: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(
            campuses.map((c) => ({
                id: c.id,
                name: c.name,
                oversightName: c.parent?.name ?? null,
                openMinutes: c.expenseWindowOpenMinutes,
                closeMinutes: c.expenseWindowCloseMinutes,
            })),
        );
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch campuses' }, { status: 500 });
    }
}
