import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getDescendantDepartmentIds } from '@/lib/departments';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can list users
    // TODO: Add more granular checks
    if (!['SUPERADMIN', 'GLOBAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        let whereClause: any = {};

        // Filter users based on department hierarchy
        if (session.user.role !== 'SUPERADMIN') {
            if (session.user.departmentId) {
                const allowedDepartmentIds = await getDescendantDepartmentIds(session.user.departmentId);
                whereClause.departmentId = { in: allowedDepartmentIds };
            } else {
                // User has no department, can't see any users
                return NextResponse.json([]);
            }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: {
                department: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Remove passwords from response
        const safeUsers = users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });

        return NextResponse.json(safeUsers);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SUPERADMIN') {
        // TODO: Allow other admins to create users within their scope
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, email, password, role, departmentId } = body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return new NextResponse('User already exists', { status: 400 });
        }

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: await bcrypt.hash(password, 10),
                role,
                departmentId: departmentId || null,
            },
        });

        const { password: _, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
