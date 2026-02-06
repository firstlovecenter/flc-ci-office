import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generatePasswordResetSms } from '@/lib/sms-templates';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json(
        { error: 'Phone number or email is required' },
        { status: 400 }
      );
    }

    // Check if it's an email or phone number
    const isEmail = identifier.includes('@');
    
    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: isEmail 
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
      },
    });

    // Always return success to prevent user enumeration
    if (!user || !user.phone) {
      return NextResponse.json({
        message: 'If an account exists with this information, a password reset SMS has been sent.',
      });
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

    // Invalidate any existing unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Create new password reset record
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Generate 6-digit code for SMS (easier to type than full token)
    const resetCode = token.substring(0, 6).toUpperCase();

    // Send SMS with reset code only (no URL to avoid truncation)
    const formattedPhone = formatGhanaPhone(user.phone);
    const smsContent = await generatePasswordResetSms({
      resetCode: resetCode,
      expirationMinutes: 1440, // 24 hours in minutes
      // Don't include resetUrl - SMS links often get truncated
    });

    const smsSent = await sendSms({
      to: formattedPhone,
      message: smsContent,
    });

    if (!smsSent) {
      return NextResponse.json(
        { error: 'Failed to send password reset SMS. Please check that your phone number is correct or contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'If an account exists with this information, a password reset SMS has been sent.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
