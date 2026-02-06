import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAssignRole, getRoleStats } from '@/lib/roleValidation';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can check role availability
    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const userId = searchParams.get('userId') || 'new-user';

        if (role) {
            // Check if a specific role can be assigned
            const result = await canAssignRole(userId, role);
            return NextResponse.json(result);
        } else {
            // Get statistics for all roles
            const stats = await getRoleStats();
            return NextResponse.json(stats);
        }
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
