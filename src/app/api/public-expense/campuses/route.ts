import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public endpoint — returns active campuses with the public form enabled
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
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(
            campuses.map((c) => ({
                id: c.id,
                name: c.name,
                oversightName: c.parent?.name ?? null,
            })),
        );
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch campuses' }, { status: 500 });
    }
}
