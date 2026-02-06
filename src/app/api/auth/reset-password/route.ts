import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    let passwordReset;

    // If token is 6 characters, it's a code - search by prefix
    // If token is longer, it's the full token - search exact match
    if (token.length === 6) {
      // Find token that starts with this 6-digit code
      const allResets = await prisma.passwordReset.findMany({
        where: {
          used: false,
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      // Find the one whose token starts with the provided code
      passwordReset = allResets.find(reset => 
        reset.token.toUpperCase().startsWith(token.toUpperCase())
      );
    } else {
      // Full token provided - direct lookup
      passwordReset = await prisma.passwordReset.findUnique({
        where: { token },
        include: { user: true },
      });
    }

    if (!passwordReset) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (passwordReset.used) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > passwordReset.expiresAt) {
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: passwordReset.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      }),
    ]);

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
