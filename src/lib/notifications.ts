import { prisma } from './prisma';
import * as webpush from 'web-push';

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
}

export async function sendPushNotification(
  userIds: string[],
  notification: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('Push notifications not configured - skipping');
    return { sent: 0, failed: 0 };
  }

  try {
    // Get subscriptions for the specified users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
      },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
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
            })
          );
          return { success: true };
        } catch (error: any) {
          console.error('Failed to send notification:', error);
          
          // If subscription is no longer valid, delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.delete({
              where: { id: sub.id },
            }).catch(() => {});
          }
          
          return { success: false };
        }
      })
    );

    const successful = results.filter((r: any) => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;

    return { sent: successful, failed };
  } catch (error) {
    console.error('Send notification error:', error);
    return { sent: 0, failed: 0 };
  }
}
