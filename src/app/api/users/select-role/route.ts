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

        const { userRoleId } = await request.json();

        if (!userRoleId) {
            return NextResponse.json({ error: 'User role ID is required' }, { status: 400 });
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                userRoles: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify that the requested userRole belongs to this user
        const userRole = user.userRoles.find(ur => ur.id === userRoleId);
        if (!userRole) {
            return NextResponse.json(
                { error: 'You do not have access to this role' },
                { status: 403 }
            );
        }

        // Update active user role
        await prisma.user.update({
            where: { id: user.id },
            data: { activeUserRoleId: userRoleId },
        });

        return NextResponse.json({ success: true, userRoleId });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to select role' }, { status: 500 });
    }
}
