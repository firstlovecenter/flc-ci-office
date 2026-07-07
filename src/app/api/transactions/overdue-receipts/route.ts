import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOverdueUnreceiptedApprovals } from '@/lib/receipt-compliance';

// Force dynamic rendering - data is user specific
export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const overdueApprovals = await getOverdueUnreceiptedApprovals(session.user.id);

    return NextResponse.json(
        {
            overdueApprovals: overdueApprovals.map((t) => ({
                id: t.id,
                description: t.description,
                amount: t.amount,
                approvedAt: t.approvedAt.toISOString(),
            })),
        },
        {
            headers: {
                'Cache-Control': 'private, no-store, no-cache, must-revalidate',
            },
        }
    );
}
