import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** @deprecated Use /api/public-expense/campuses */
export async function GET(request: Request) {
    const url = new URL(request.url);
    url.pathname = '/api/public-expense/campuses';
    return NextResponse.redirect(url, 308);
}
