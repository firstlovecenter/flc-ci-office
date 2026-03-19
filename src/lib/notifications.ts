import { prisma } from './prisma';
import * as webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@flc-ci.org';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

interface PushSubscriptionRecord {
    id: string;
    subscription: unknown;
}

export async function sendPushNotification(
    userIds: string[],
    notification: NotificationPayload,
): Promise<{ sent: number; failed: number }> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return { sent: 0, failed: 0 };
    }

    try {
        // Get subscriptions for the specified users
        const subscriptions = await (
            prisma as unknown as {
                pushSubscription: {
                    findMany: (args: unknown) => Promise<PushSubscriptionRecord[]>;
                    delete: (args: unknown) => Promise<void>;
                };
            }
        ).pushSubscription.findMany({
            where: {
                userId: { in: userIds },
            },
        });

        if (subscriptions.length === 0) {
            return { sent: 0, failed: 0 };
        }

        // Send notifications concurrently
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        sub.subscription as Parameters<typeof webpush.sendNotification>[0],
                        JSON.stringify({
                            title: notification.title,
                            body: notification.body,
                            url: notification.url ?? '/',
                            icon: notification.icon ?? '/icon-192x192.png',
                            badge: notification.badge ?? '/icon-192x192.png',
                            tag: notification.tag ?? 'default',
                            requireInteraction: notification.requireInteraction ?? false,
                        }),
                    );
                    return { success: true };
                } catch (error) {
                    // Remove stale subscriptions (410 Gone / 404 Not Found)
                    const statusCode = (error as { statusCode?: number }).statusCode;
                    if (statusCode === 410 || statusCode === 404) {
                        await (
                            prisma as unknown as {
                                pushSubscription: { delete: (args: unknown) => Promise<void> };
                            }
                        ).pushSubscription
                            .delete({ where: { id: sub.id } })
                            .catch(() => {});
                    }
                    return { success: false };
                }
            }),
        );

        const successful = results.filter(
            (r) => r.status === 'fulfilled' && r.value.success,
        ).length;

        return { sent: successful, failed: results.length - successful };
    } catch (error) {
        console.error('[Push] Failed to send notifications:', error);
        return { sent: 0, failed: 0 };
    }
}
