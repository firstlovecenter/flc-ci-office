import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getAllSubDepartments(departmentId: string): Promise<string[]> {
    const children = await prisma.department.findMany({
        where: { parentId: departmentId },
        select: { id: true }
    });

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c: { id: string }) => c.id);
    const subChildren = await Promise.all(
        childIds.map((id: string) => getAllSubDepartments(id))
    );

    return [...childIds, ...subChildren.flat()];
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json({ results: [] });
        }

        const normalizedRole = (session.user.role || '').toUpperCase();
        let departmentIds: string[] | null = null; // null means all

        if (normalizedRole !== 'SUPERADMIN') {
            const userDept = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { department: true }
            });

            if (userDept?.departmentId) {
                const allSubDepts = await getAllSubDepartments(userDept.departmentId);
                departmentIds = [userDept.departmentId, ...allSubDepts];
            } else {
                // If user has no department but is not superadmin, restrict to nothing
                departmentIds = [];
            }
        }

        const deptFilter = departmentIds ? { departmentId: { in: departmentIds } } : {};
        const deptIdFilter = departmentIds ? { id: { in: departmentIds } } : {};

        // Parallel Search
        const [users, departments, transactions] = await Promise.all([
            // Search Users
            prisma.user.findMany({
                where: {
                    AND: [
                        { ...deptFilter },
                        {
                            OR: [
                                { name: { contains: query, mode: 'insensitive' } },
                                { email: { contains: query, mode: 'insensitive' } },
                                { phone: { contains: query, mode: 'insensitive' } }
                            ]
                        }
                    ]
                },
                take: 5,
                select: { id: true, name: true, email: true, image: true, department: { select: { name: true } } }
            }),

            // Search Departments
            prisma.department.findMany({
                where: {
                    AND: [
                        { ...deptIdFilter },
                        { name: { contains: query, mode: 'insensitive' } }
                    ]
                },
                take: 5,
                select: { id: true, name: true, level: true }
            }),

            // Search Transactions
            prisma.transaction.findMany({
                where: {
                    AND: [
                        { ...deptFilter },
                        { description: { contains: query, mode: 'insensitive' } }
                    ]
                },
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, description: true, amount: true, status: true, createdAt: true, type: true }
            })
        ]);

        // Format results
        const results = [
            ...users.map(u => ({
                type: 'user',
                id: u.id,
                title: u.name || 'Unknown',
                subtitle: u.department?.name || u.email,
                url: `/users/${u.id}`,
                image: u.image
            })),
            ...departments.map(d => ({
                type: 'department',
                id: d.id,
                title: d.name,
                subtitle: d.level || 'Department',
                url: `/departments/${d.id}/dashboard`
            })),
            ...transactions.map(t => ({
                type: 'transaction',
                id: t.id,
                title: t.description,
                subtitle: `${t.type} - ${parseFloat(t.amount.toString()).toFixed(2)}`, 
                status: t.status,
                date: t.createdAt,
                url: `/transactions?search=${encodeURIComponent(t.description)}`
            }))
        ];

        return NextResponse.json({ results });

    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
