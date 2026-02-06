import { NextRequest, NextResponse } from 'next/server';
import { sendSms, checkSmsBalance, formatGhanaPhone, isSmsConfigured } from '@/lib/sms';

export async function POST(request: NextRequest) {
  try {
    const { phone, senderIdOverride } = await request.json();

    if (!isSmsConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SMSOptics API key not configured',
        },
        { status: 500 }
      );
    }

    const recipient = phone || '0557382057';
    const formattedPhone = formatGhanaPhone(recipient);

    // Check balance first
    const balance = await checkSmsBalance();

    // Send test SMS
    const success = await sendSms({
      to: formattedPhone,
      message: 'Test SMS from FLC Accounts via SMSOptics',
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully',
        recipient: formattedPhone,
        balance: balance,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send SMS',
          recipient: formattedPhone,
          balance: balance,
        },
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
  const balance = await checkSmsBalance();
  return NextResponse.json({
    message: 'POST to this endpoint with { "phone": "0XXXXXXXXX" }',
    configured: isSmsConfigured(),
    balance: balance,
  });
}
