import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as webpush from 'web-push';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { Role } from '@prisma/client';
import { ROLE_HIERARCHY } from '@/lib/roles';
import { callerOrganisationId, getCallerScope } from '@/lib/user-scope';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_SMS_LENGTH = 320; // two segments
const MAX_RECIPIENTS = 100;

// Configure web-push with VAPID keys
// In production, these should be environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@flc-ci.org';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

// Send push notification to specific users or SMS
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can send notifications
    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    if (!session.user.role || !adminRoles.includes(session.user.role)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const body = await req.json();
    
    // Check if this is an SMS request
    if (body.message && body.recipientType) {
      return handleSMSRequest(session, body);
    }

    // Push notifications are not currently available (PushSubscription model not in schema)
    return new NextResponse('Push notifications are not currently available. Use SMS notifications instead.', { status: 501 });

    /* Original push notification logic - disabled until PushSubscription model is added to schema
    const { userIds, notification } = body as { userIds: string[]; notification: NotificationPayload };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new NextResponse('Invalid user IDs', { status: 400 });
    }

    if (!notification || !notification.title || !notification.body) {
      return new NextResponse('Invalid notification payload', { status: 400 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new NextResponse('Push notifications not configured', { status: 500 });
    }

    // Get subscriptions for the specified users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        sent: 0,
        message: 'No subscriptions found for specified users' 
      });
    }

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            sub.subscription as any,
            JSON.stringify({
              title: notification.title,
              body: notification.body,
              url: notification.url || '/',
              icon: notification.icon || '/icon-192x192.png',
              badge: notification.badge || '/icon-192x192.png',
              tag: notification.tag || 'default',
              requireInteraction: notification.requireInteraction || false,
              actions: notification.actions || [],
            })
          );
          return { success: true, subscriptionId: sub.id };
        } catch (error: any) {
          
          // If subscription is no longer valid, delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }
          
          return { success: false, subscriptionId: sub.id, error: error.message };
        }
      })
    );

    const successful = results.filter((r: any) => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;

    return NextResponse.json({ 
      success: true, 
      sent: successful,
      failed,
      total: subscriptions.length,
    });
    */
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function handleSMSRequest(
  session: { user: { id: string; role: string; organisationId?: string | null; activeUserRole?: { organisationId?: string | null } | null } },
  body: any,
) {
  const { message, recipientType, phoneNumber, role, organisationId } = body;

  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.length > MAX_SMS_LENGTH) {
    return NextResponse.json({ error: `Message must be at most ${MAX_SMS_LENGTH} characters` }, { status: 400 });
  }

  // Operator-paid SMS: cap how often one person can fan out (secondary,
  // per-isolate control).
  const rl = checkRateLimit(`notify-sms:${session.user.id}`, { maxRequests: 5, windowSeconds: 10 * 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many notifications sent. Please try again later.' }, { status: 429 });
  }

  // Non-super callers may only reach people in their own church subtree.
  const isSuperAdmin = session.user.role === 'SUPERADMIN';
  const scope = await getCallerScope({
    role: session.user.role,
    organisationId: callerOrganisationId(session),
  });
  const scopeIds = scope === 'ALL' ? null : [...scope];
  const outOfScope = (id: string) => scopeIds !== null && !scopeIds.includes(id);

  try {
    let recipients: { phone?: string; email?: string; name: string }[] = [];

    if (recipientType === 'individual') {
      if (typeof phoneNumber !== 'string' || !phoneNumber) {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
      }
      const formattedPhone = formatGhanaPhone(phoneNumber);
      if (!formattedPhone) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
      const userByPhone = await prisma.user.findFirst({
        where: {
          phone: phoneNumber,
          archived: false,
          // Anyone but a super admin may only message users holding a live
          // role inside their own subtree — never an arbitrary number.
          ...(isSuperAdmin ? {} : { userRoles: { some: { organisationId: { in: scopeIds ?? [] } } } }),
        },
        select: { email: true, name: true },
      });
      if (!userByPhone && !isSuperAdmin) {
        return NextResponse.json({ error: 'Recipient is not in your church hierarchy' }, { status: 403 });
      }
      recipients.push({ phone: formattedPhone, email: userByPhone?.email || undefined, name: userByPhone?.name || 'Individual' });
    } else if (recipientType === 'role') {
      if (typeof role !== 'string' || !Object.hasOwn(ROLE_HIERARCHY, role)) {
        return NextResponse.json({ error: 'A valid role is required' }, { status: 400 });
      }
      if (organisationId && outOfScope(organisationId)) {
        return NextResponse.json({ error: 'Church is outside your hierarchy' }, { status: 403 });
      }

      const userRoles = await prisma.userRole.findMany({
        where: {
          role: role as Role,
          user: { archived: false },
          ...(scopeIds !== null
            ? { organisationId: organisationId ? organisationId : { in: scopeIds } }
            : organisationId ? { organisationId } : {}),
        },
        take: MAX_RECIPIENTS + 1,
        include: {
          user: {
            select: {
              phone: true,
              email: true,
              name: true,
            },
          },
        },
      });

      recipients = userRoles
        .map(ur => ({
          phone: ur.user.phone ? formatGhanaPhone(ur.user.phone) || undefined : undefined,
          email: ur.user.email || undefined,
          name: ur.user.name || 'User',
        }))
        .filter(r => r.phone || r.email);
    } else if (recipientType === 'organisation') {
      if (typeof organisationId !== 'string' || !organisationId) {
        return NextResponse.json({ error: 'Church is required' }, { status: 400 });
      }
      if (outOfScope(organisationId)) {
        return NextResponse.json({ error: 'Church is outside your hierarchy' }, { status: 403 });
      }

      const userRolesInDept = await prisma.userRole.findMany({
        where: {
          organisationId: organisationId,
          user: { archived: false },
        },
        take: MAX_RECIPIENTS + 1,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Deduplicate by user ID
      const seenUserIds = new Set<string>();
      recipients = userRolesInDept
        .filter(ur => {
          if (seenUserIds.has(ur.user.id)) return false;
          seenUserIds.add(ur.user.id);
          return true;
        })
        .map(ur => ({
          phone: ur.user.phone ? formatGhanaPhone(ur.user.phone) || undefined : undefined,
          email: ur.user.email || undefined,
          name: ur.user.name || 'User',
        }))
        .filter(r => r.phone || r.email);
    } else {
      return NextResponse.json({ error: 'Invalid recipient type' }, { status: 400 });
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Too many recipients (maximum ${MAX_RECIPIENTS}). Narrow the audience.` },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json({ 
        error: 'No recipients found with valid contact details' 
      }, { status: 400 });
    }

    // Send SMS to all recipients
    const results = await Promise.allSettled(
      recipients.map(async recipient => {
        let smsResult = false;

        if (recipient.phone) {
          smsResult = await sendSms({ to: recipient.phone, message }).catch(() => false);
        }

        return { smsResult };
      })
    );

    const successful = results.filter(r =>
      r.status === 'fulfilled' && r.value.smsResult
    ).length;
    const failed = results.length - successful;
    const smsSent = results.filter(r => r.status === 'fulfilled' && r.value.smsResult).length;

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${successful} of ${recipients.length} recipient(s)`,
      sent: successful,
      failed: failed,
      total: recipients.length,
      smsSent,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to send notification: ' + error.message 
    }, { status: 500 });
  }
}
