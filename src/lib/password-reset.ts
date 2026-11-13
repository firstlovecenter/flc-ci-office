import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generateFirstRoleAssignmentEmail } from '@/lib/email-templates';
import { getAppOrigin } from '@/lib/password-reset-origin';

export { getAppOrigin };

/** Lifetime of a self-service "forgot password" link. */
export const RESET_LINK_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Lifetime of an admin-issued first-login setup link. */
export const SETUP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Max reset emails per account per rolling window (DB-backed, per-account). */
export const RESET_EMAIL_LIMIT = 3;
export const RESET_EMAIL_WINDOW_MS = 60 * 60 * 1000;

export function buildResetUrl(origin: string, token: string): string {
  return `${origin}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Create a single-use reset token for a user and return the link.
 * Returns null (and logs) if the app origin is not configured — nothing is
 * written in that case, so no dangling token exists.
 */
export async function issueResetLink(
  userId: string,
  ttlMs: number,
  options: { invalidatePrevious?: boolean } = {},
): Promise<string | null> {
  const origin = getAppOrigin();
  if (!origin) {
    console.error('[password-reset] NEXTAUTH_URL is not configured to a valid https origin; reset link not issued.');
    return null;
  }
  const token = crypto.randomBytes(32).toString('hex');
  if (options.invalidatePrevious) {
    await prisma.passwordReset.updateMany({
      where: { userId, used: false },
      data: { used: true, usedAt: new Date() },
    });
  }
  await prisma.passwordReset.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return buildResetUrl(origin, token);
}

/**
 * Whether another reset email may be sent for this account right now.
 * Counts PasswordReset rows created in the window, so it holds across
 * isolates and regardless of the caller's IP.
 */
export async function isResetEmailThrottled(userId: string): Promise<boolean> {
  const recent = await prisma.passwordReset.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - RESET_EMAIL_WINDOW_MS) } },
  });
  return recent >= RESET_EMAIL_LIMIT;
}

/**
 * Issue a first-login / setup link and deliver it by email only.
 * A user without an email on file gets nothing (an admin must set one).
 * Never throws; returns whether an email was sent.
 */
export async function sendSetupLinkEmail(params: {
  user: { id: string; name: string | null; email: string | null };
  role: string;
  organisationName: string;
}): Promise<boolean> {
  const { user, role, organisationName } = params;
  try {
    if (!user.email || !isEmailConfigured()) return false;
    const resetLink = await issueResetLink(user.id, SETUP_LINK_TTL_MS);
    if (!resetLink) return false;
    const { subject, html } = generateFirstRoleAssignmentEmail({
      userName: user.name || 'User',
      role,
      organisation: organisationName,
      resetLink,
    });
    return await sendEmail({ to: user.email, subject, html });
  } catch (error) {
    console.error('[password-reset] Failed to send setup email:', error);
    return false;
  }
}
