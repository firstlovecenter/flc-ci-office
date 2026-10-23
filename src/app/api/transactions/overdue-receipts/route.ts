import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOverdueUnreceiptedApprovals } from '@/lib/receipt-compliance';

// Force dynamic rendering - data is user specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Scoped to one account when given, so another account's outstanding
    // receipts don't block this one.
    const organisationId = new URL(request.url).searchParams.get('organisationId');
    const overdueApprovals = await getOverdueUnreceiptedApprovals(session.user.id, organisationId);

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
