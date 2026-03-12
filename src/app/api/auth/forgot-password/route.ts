import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { generatePasswordResetSms } from '@/lib/sms-templates';
import { sendEmail } from '@/lib/email';
import { generatePasswordResetEmail } from '@/lib/email-templates';
import { checkRateLimit, rateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 requests per 15 minutes per IP
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
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this information, password reset instructions have been sent.',
      });
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12); // 12 hours expiration for reset link

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
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Generate 6-digit code for SMS (easier to type than full token)
    const resetCode = token.substring(0, 6).toUpperCase();

    let smsSent = false;
    let emailSent = false;

    // Send SMS with reset code only (no URL to avoid truncation)
    if (user.phone) {
      const formattedPhone = formatGhanaPhone(user.phone);
      if (formattedPhone) {
        const smsContent = await generatePasswordResetSms({
          resetCode: resetCode,
          expirationMinutes: 15, // OTP validity window
          // Don't include resetUrl - SMS links often get truncated
        });

        smsSent = await sendSms({
          to: formattedPhone,
          message: smsContent,
        });
      }
    }

    // Send email if user has an email address
    if (user.email) {
      const baseUrl =
        process.env.APP_URL ||
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : '');
      const resetUrl = baseUrl ? `${baseUrl}/auth/reset-password?token=${token}` : undefined;
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
