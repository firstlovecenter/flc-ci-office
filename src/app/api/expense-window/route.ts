import { NextResponse } from 'next/server';
import { getExpenseWindowConfig } from '@/lib/expense-window-settings';

export const dynamic = 'force-dynamic';

/**
 * The submission window in force. Public: the unauthenticated expense-request
 * form needs it to tell people when it opens. Holds nothing but two times.
 */
export async function GET() {
    const { openMinutes, closeMinutes, updatedAt } = await getExpenseWindowConfig();
    return NextResponse.json({ openMinutes, closeMinutes, updatedAt });
}
