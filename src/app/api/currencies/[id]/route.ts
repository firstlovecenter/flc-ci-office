import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT() {
  return NextResponse.json(
    { error: 'Currency management is disabled. The app uses Ghana Cedis (GHS) only.' },
    { status: 410 },
  );
}

export async function PATCH() {
  return PUT();
}
