import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/password-validation';
import { checkRateLimit, rateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`reset-password:${ip}`, rateLimits.resetPassword);
    if (!rl.success) {
      return rateLimitResponse(rl);
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password complexity
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors.join('. ') },
        { status: 400 }
      );
    }

    // Only the full random token is accepted: exact lookup, single use.
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const passwordReset = await prisma.passwordReset.findUnique({
      where: { token },
      select: { id: true, userId: true, used: true, expiresAt: true },
    });

    if (!passwordReset || passwordReset.used || new Date() > passwordReset.expiresAt) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Consume the token atomically (guards against a concurrent replay), set the
    // password, and invalidate every other outstanding reset for the account.
    const now = new Date();
    const consumed = await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordReset.updateMany({
        where: { id: passwordReset.id, used: false, expiresAt: { gt: now } },
        data: { used: true, usedAt: now },
      });
      if (claim.count !== 1) return false;
      await tx.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword, passwordChangedAt: now, updatedAt: now },
      });
      await tx.passwordReset.updateMany({
        where: { userId: passwordReset.userId, used: false },
        data: { used: true, usedAt: now },
      });
      return true;
    });

    if (!consumed) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while resetting your password' },
      { status: 500 }
    );
  }
}
