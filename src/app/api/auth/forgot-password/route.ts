import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generatePasswordResetSms } from '@/lib/sms-templates';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generatePasswordResetEmail } from '@/lib/email-templates';
import { checkRateLimit, rateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`forgot-password:${ip}`, rateLimits.forgotPassword);
    if (!rl.success) {
      return rateLimitResponse(rl);
    }

    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json(
        { error: 'Phone number or email is required' },
        { status: 400 }
      );
    }

    const isEmail = identifier.includes('@');

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
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this information, password reset instructions have been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12);

    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true, usedAt: new Date() },
    });

    await prisma.passwordReset.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetCode = token.substring(0, 6).toUpperCase();
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/+$/, '');
    const resetUrl = baseUrl
      ? `${baseUrl}/auth/reset-password?token=${token}`
      : undefined;

    let smsSent = false;
    let emailSent = false;

    if (user.phone) {
      const formattedPhone = formatGhanaPhone(user.phone);
      if (formattedPhone) {
        const smsContent = await generatePasswordResetSms({
          resetCode,
          expirationMinutes: 15,
        });
        smsSent = await sendSms({ to: formattedPhone, message: smsContent });
      }
    }

    if (user.email && isEmailConfigured()) {
      const { subject, html } = generatePasswordResetEmail({
        userName: user.name || undefined,
        resetCode,
        resetUrl,
        expirationHours: 12,
        otpExpirationMinutes: 15,
      });
      emailSent = await sendEmail({ to: user.email, subject, html });
    }

    if (!smsSent && !emailSent) {
      return NextResponse.json(
        { error: 'Failed to send password reset instructions. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'If an account exists with this information, password reset instructions have been sent.',
      channels: {
        sms: smsSent,
        email: emailSent,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
