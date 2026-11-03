import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/format-money';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

async function getAllSubOrganisations(organisationId: string): Promise<string[]> {
    const children = await prisma.organisation.findMany({
        where: { parentId: organisationId },
        select: { id: true }
    });

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c: { id: string }) => c.id);
    const subChildren = await Promise.all(
        childIds.map((id: string) => getAllSubOrganisations(id))
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
        let organisationIds: string[] | null = null; // null means all

        if (normalizedRole !== 'SUPERADMIN') {
            // Use activeUserRole if available, otherwise use user's base organisation
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;

            if (filterOrganisationId) {
                const allSubDepts = await getAllSubOrganisations(filterOrganisationId);
                organisationIds = [filterOrganisationId, ...allSubDepts];
            } else {
                // If user has no organisation but is not superadmin, restrict to nothing
                organisationIds = [];
            }
        }

        const deptFilter = organisationIds ? { organisationId: { in: organisationIds } } : {};
        const deptIdFilter = organisationIds ? { id: { in: organisationIds } } : {};

        // Parallel Search
        const [users, organisations, transactions] = await Promise.all([
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
                select: { id: true, name: true, email: true, image: true, organisation: { select: { name: true } } }
            }),

            // Search Organisations
            prisma.organisation.findMany({
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
                subtitle: u.organisation?.name || u.email,
                url: `/users?id=${u.id}`,
                image: u.image
            })),
            ...organisations.map(d => ({
                type: 'organisation',
                id: d.id,
                title: d.name,
                subtitle: d.level || 'Church',
                // Opens the record's sheet in place; accounts live on /accounts.
                url: d.level === 'COUNCIL' ? `/accounts?id=${d.id}` : `/organisations?id=${d.id}`
            })),
            ...transactions.map(t => ({
                type: 'transaction',
                id: t.id,
                title: t.description,
                subtitle: `${t.type} - ${formatMoney(t.amount.toString())}`,
                status: t.status,
                date: t.createdAt,
                // Pending withdrawals open in the approvals queue; everything else
                // opens on the ledger, searched down so the entry is on page one.
                url: t.status === 'PENDING' && t.type === 'EXPENSE'
                    ? `/approvals?id=${t.id}`
                    : `/transactions?search=${encodeURIComponent(t.description)}&id=${t.id}`
            }))
        ];

        return NextResponse.json({ results });

    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
