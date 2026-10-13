import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getExpenseWindowForOrganisation } from '@/lib/expense-window-settings';

export const dynamic = 'force-dynamic';

/**
 * The submission window for an organisation — a campus, or an account (which
 * uses its campus's window). Holds nothing but two times and the campus name.
 * The public request form gets campus windows from /api/public-expense/campuses.
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const organisationId = request.nextUrl.searchParams.get('organisationId');
    const { openMinutes, closeMinutes, campusId, campusName, updatedAt } = await getExpenseWindowForOrganisation(organisationId);
    return NextResponse.json({ openMinutes, closeMinutes, campusId, campusName, updatedAt });
}
