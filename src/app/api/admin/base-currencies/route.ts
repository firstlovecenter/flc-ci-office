import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAppCurrency } from '@/lib/currency';

export const dynamic = 'force-dynamic';

/** Oversight base currencies retired — always GHS. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const ghs = await getAppCurrency();
  return NextResponse.json([{ currencyId: ghs.id, currency: ghs }]);
}

export async function POST() {
  return NextResponse.json(
    { error: 'Base currency management is disabled. The app uses Ghana Cedis (GHS) only.' },
    { status: 410 },
  );
}

export async function DELETE() {
  return POST();
}
