import { NextRequest, NextResponse } from 'next/server';
import { sendSms, formatGhanaPhone, isSmsConfigured } from '@/lib/sms';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 });
  }

  try {
    const { phone, senderIdOverride } = await request.json();

    if (!isSmsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'FLC notify is not configured (missing FLC_NOTIFY_URL or FLC_NOTIFY_KEY)' },
        { status: 500 }
      );
    }

    const recipient = phone || '0557382057';
    const formattedPhone = formatGhanaPhone(recipient);

    const success = await sendSms({
      to: formattedPhone,
      message: 'Test SMS from CI Office via FLC notify',
    });

    if (success) {
      return NextResponse.json({ success: true, message: 'SMS sent successfully', recipient: formattedPhone });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send SMS', recipient: formattedPhone },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 });
  }

  return NextResponse.json({
    message: 'POST to this endpoint with { "phone": "0XXXXXXXXX" }',
    configured: isSmsConfigured(),
  });
}
