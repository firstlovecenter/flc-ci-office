import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session.user.isImpersonating || !session.user.originalAdminId) {
            return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 });
        }

        // Log the stop-impersonation action against the original admin's ID
        await prisma.auditLog.create({
            data: {
                userId: session.user.originalAdminId,
                actionType: 'STOP_IMPERSONATION',
                entityType: 'User',
                entityId: session.user.id,
                description: `Super admin stopped impersonating user: ${session.user.name} (${session.user.email})`,
                severity: 'HIGH',
                success: true,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                userAgent: request.headers.get('user-agent') || undefined,
                metadata: {
                    impersonatedUserId: session.user.id,
                    impersonatedUserEmail: session.user.email,
                    adminId: session.user.originalAdminId,
                    adminName: session.user.originalAdminName,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Stop impersonation error:', error);
        return NextResponse.json({ error: 'Failed to stop impersonation' }, { status: 500 });
    }
}
