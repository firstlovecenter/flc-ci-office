import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SUPERADMIN_EMAIL = 'skaduteye@gmail.com';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only SUPERADMIN can impersonate
        if (session.user.role !== 'SUPERADMIN' || session.user.email !== SUPERADMIN_EMAIL) {
            return NextResponse.json({ error: 'Forbidden: Only super admin can impersonate users' }, { status: 403 });
        }

        // Cannot impersonate while already impersonating
        if (session.user.isImpersonating) {
            return NextResponse.json({ error: 'Cannot impersonate while already impersonating' }, { status: 400 });
        }

        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Cannot impersonate self
        if (userId === session.user.id) {
            return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, archived: true, activeRole: true },
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (targetUser.archived) {
            return NextResponse.json({ error: 'Cannot impersonate archived user' }, { status: 400 });
        }

        // Log the impersonation action
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'IMPERSONATE',
                entityType: 'User',
                entityId: targetUser.id,
                description: `Super admin impersonated user: ${targetUser.name} (${targetUser.email})`,
                severity: 'CRITICAL',
                success: true,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                userAgent: request.headers.get('user-agent') || undefined,
                metadata: {
                    targetUserId: targetUser.id,
                    targetUserEmail: targetUser.email,
                    targetUserName: targetUser.name,
                    adminId: session.user.id,
                    adminEmail: session.user.email,
                },
            },
        });

        return NextResponse.json({ success: true, targetUserId: targetUser.id });
    } catch (error) {
        console.error('Impersonate error:', error);
        return NextResponse.json({ error: 'Failed to start impersonation' }, { status: 500 });
    }
}
