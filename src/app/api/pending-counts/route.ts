import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionStatus } from '@prisma/client';
import { getDescendantDepartmentIds } from '@/lib/departments';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role;
        const userId = session.user.id;

        // Only admins see pending approvals
        const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
        const isAdmin = adminRoles.includes(userRole);

        // Determine which department to use for filtering
        // For users with multiple roles, use the activeUserRole's department
        let filterDepartmentId = session.user.departmentId;
        
        if (session.user.activeUserRole?.departmentId) {
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        // Run queries in parallel for better performance
        const [pendingApprovals, pendingTransactions] = await Promise.all([
            isAdmin ? (
                session.user.role === 'SUPERADMIN' || session.user.role === 'GLOBAL_ADMIN'
                    ? prisma.transaction.count({
                        where: { status: TransactionStatus.PENDING },
                    })
                    : filterDepartmentId
                    ? prisma.transaction.count({
                        where: {
                            status: TransactionStatus.PENDING,
                            departmentId: {
                                in: await getDescendantDepartmentIds(filterDepartmentId)
                            }
                        },
                    })
                    : Promise.resolve(0)
            ) : Promise.resolve(0),
            prisma.transaction.count({
                where: {
                    userId: userId,
                    status: TransactionStatus.PENDING,
                },
            }),
        ]);

        return NextResponse.json(
            {
                approvals: pendingApprovals,
                transactions: pendingTransactions,
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
                },
            }
        );
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch pending counts' },
            { status: 500 }
        );
    }
}
