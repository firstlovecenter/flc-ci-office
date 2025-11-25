import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = session.user.role;
        const userId = session.user.id;

        // Initialize counts
        let pendingApprovals = 0;
        let pendingTransactions = 0;

        // Only admins see pending approvals
        const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
        if (adminRoles.includes(userRole)) {
            // Get pending transactions that need approval
            pendingApprovals = await prisma.transaction.count({
                where: {
                    status: TransactionStatus.PENDING,
                },
            });
        }

        // Get user's pending transactions (transactions they created that are pending)
        pendingTransactions = await prisma.transaction.count({
            where: {
                userId: userId,
                status: TransactionStatus.PENDING,
            },
        });

        return NextResponse.json({
            approvals: pendingApprovals,
            transactions: pendingTransactions,
        });
    } catch (error) {
        console.error('Error fetching pending counts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending counts' },
            { status: 500 }
        );
    }
}
