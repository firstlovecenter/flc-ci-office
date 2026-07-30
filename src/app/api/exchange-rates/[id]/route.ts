import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT() {
  return NextResponse.json(
    { error: 'Exchange rates are disabled. The app uses Ghana Cedis (GHS) only.' },
    { status: 410 },
  );
}

export async function DELETE() {
  return PUT();
}
