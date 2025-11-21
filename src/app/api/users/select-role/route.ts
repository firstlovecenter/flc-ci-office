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

        const { role } = await request.json();

        if (!role) {
            return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, roles: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify that the requested role is in user's roles
        if (!user.roles.includes(role)) {
            return NextResponse.json(
                { error: 'You do not have access to this role' },
                { status: 403 }
            );
        }

        // Update active role
        await prisma.user.update({
            where: { id: user.id },
            data: { activeRole: role },
        });

        return NextResponse.json({ success: true, role });
    } catch (error) {
        console.error('Error selecting role:', error);
        return NextResponse.json({ error: 'Failed to select role' }, { status: 500 });
    }
}
