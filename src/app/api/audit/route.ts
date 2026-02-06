import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only superadmins can view audit logs
    if (session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Forbidden - Only superadmins can view audit logs', { status: 403 });
    }

    try {
        const logs = await prisma.auditLog.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                timestamp: 'desc',
            },
            take: 1000, // Limit to last 1000 logs for performance
        });

        return NextResponse.json(logs);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
