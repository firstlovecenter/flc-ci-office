import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generatePasswordResetEmail } from '@/lib/email-templates';
import {
  issueResetLink,
  isResetEmailThrottled,
  RESET_LINK_TTL_MS,
} from '@/lib/password-reset';
import { checkRateLimit, rateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const GENERIC_RESPONSE = {
  message:
    'If an account exists for that email address, a password reset link has been sent to it.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password recovery is email-only. The response is identical whether or not an
 * account exists, has an email, is throttled, or the send failed, so the
 * endpoint is not an account-existence oracle.
 */
export async function POST(request: NextRequest) {
  try {
    // Secondary control only — the primary throttle is per-account (below).
    const ip = getClientIp(request);
    const rl = checkRateLimit(`forgot-password:${ip}`, rateLimits.forgotPassword);
    if (!rl.success) {
      return rateLimitResponse(rl);
    }

    const body = await request.json().catch(() => null);
    const raw = body && typeof body.email === 'string' ? body.email : body?.identifier;
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { email, archived: false },
      select: { id: true, email: true, name: true },
    });

    if (user?.email && isEmailConfigured()) {
      try {
        if (!(await isResetEmailThrottled(user.id))) {
          const resetUrl = await issueResetLink(user.id, RESET_LINK_TTL_MS);
          if (resetUrl) {
            const { subject, html } = generatePasswordResetEmail({
              userName: user.name || undefined,
              resetUrl,
              expirationMinutes: RESET_LINK_TTL_MS / 60000,
            });
            await sendEmail({ to: user.email, subject, html });
          }
        }
      } catch (error) {
        console.error('[forgot-password] failed to issue reset email:', error);
      }
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('[forgot-password] error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 },
    );
  }
}
