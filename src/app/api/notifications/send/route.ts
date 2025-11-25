import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as webpush from 'web-push';
import { sendSms, formatGhanaPhone } from '@/lib/sms';
import { Role } from '@prisma/client';

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
    const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
    if (!session.user.role || !adminRoles.includes(session.user.role)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const body = await req.json();
    
    // Check if this is an SMS request
    if (body.message && body.recipientType) {
      return handleSMSRequest(body);
    }

    // Original push notification logic
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
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function handleSMSRequest(body: any) {
  const { message, recipientType, phoneNumber, role, departmentId } = body;

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    let recipients: { phone: string; name: string }[] = [];

    if (recipientType === 'individual') {
      if (!phoneNumber) {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
      }
      const formattedPhone = formatGhanaPhone(phoneNumber);
      if (!formattedPhone) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
      recipients.push({ phone: formattedPhone, name: 'Individual' });
    } else if (recipientType === 'role') {
      if (!role) {
        return NextResponse.json({ error: 'Role is required' }, { status: 400 });
      }
      
      // Get all users with this role and phone numbers
      const userRoles = await prisma.userRole.findMany({
        where: {
          role: role as Role,
        },
        include: {
          user: {
            select: {
              phone: true,
              name: true,
            },
          },
        },
      });

      recipients = userRoles
        .filter(ur => ur.user.phone)
        .map(ur => ({
          phone: formatGhanaPhone(ur.user.phone!) || '',
          name: ur.user.name || 'User',
        }))
        .filter(r => r.phone);
    } else if (recipientType === 'department') {
      if (!departmentId) {
        return NextResponse.json({ error: 'Department is required' }, { status: 400 });
      }

      // Get all users in this department with phone numbers
      const users = await prisma.user.findMany({
        where: {
          departmentId: departmentId,
          phone: { not: "" },
        },
        select: {
          phone: true,
          name: true,
        },
      });

      recipients = users
        .filter(u => u.phone)
        .map(u => ({
          phone: formatGhanaPhone(u.phone!) || '',
          name: u.name || 'User',
        }))
        .filter(r => r.phone);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ 
        error: 'No recipients found with valid phone numbers' 
      }, { status: 400 });
    }

    // Send SMS to all recipients
    const results = await Promise.allSettled(
      recipients.map(recipient =>
        sendSms({
          to: recipient.phone,
          message: message,
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      message: `SMS sent to ${successful} of ${recipients.length} recipient(s)`,
      sent: successful,
      failed: failed,
      total: recipients.length,
    });
  } catch (error: any) {
    console.error('SMS Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send SMS: ' + error.message 
    }, { status: 500 });
  }
}
