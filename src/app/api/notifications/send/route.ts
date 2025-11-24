import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as webpush from 'web-push';

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

// Send push notification to specific users
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
