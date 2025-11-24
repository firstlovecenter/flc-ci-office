'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Button,
    Alert,
    CircularProgress,
    Chip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';

export default function NotificationSettings() {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        checkNotificationSupport();
        checkSubscriptionStatus();
    }, []);

    const checkNotificationSupport = () => {
        const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        setIsSupported(supported);
        
        if (supported) {
            setPermission(Notification.permission);
        }
    };

    const checkSubscriptionStatus = async () => {
        try {
            setLoading(true);

            // Check if service worker is registered
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Verify with backend
                const response = await fetch('/api/notifications/subscribe');
                if (response.ok) {
                    const data = await response.json();
                    setIsSubscribed(data.subscribed);
                }
            } else {
                setIsSubscribed(false);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPushNotifications = async () => {
        try {
            setProcessing(true);
            setError('');
            setSuccess('');

            // Request notification permission
            const permission = await Notification.requestPermission();
            setPermission(permission);

            if (permission !== 'granted') {
                setError('Notification permission denied');
                return;
            }

            // Get VAPID public key from environment
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                setError('Push notifications not configured on server');
                return;
            }

            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });

            // Send subscription to backend
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription }),
            });

            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }

            setIsSubscribed(true);
            setSuccess('Push notifications enabled successfully!');

            // Send a test notification
            setTimeout(() => {
                new Notification('Notifications Enabled!', {
                    body: 'You will now receive push notifications from FLC CI Office',
                    icon: '/icon-192x192.png',
                });
            }, 500);
        } catch (error: any) {
            setError(error.message || 'Failed to enable notifications');
        } finally {
            setProcessing(false);
        }
    };

    const unsubscribeFromPushNotifications = async () => {
        try {
            setProcessing(true);
            setError('');
            setSuccess('');

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                // Remove from backend
                await fetch('/api/notifications/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
            }

            setIsSubscribed(false);
            setSuccess('Push notifications disabled');
        } catch (error: any) {
            setError(error.message || 'Failed to disable notifications');
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleNotifications = async () => {
        if (isSubscribed) {
            await unsubscribeFromPushNotifications();
        } else {
            await subscribeToPushNotifications();
        }
    };

    const sendTestNotification = async () => {
        try {
            setProcessing(true);
            setError('');

            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Notification',
                    body: 'This is a test push notification from FLC CI Office',
                    url: '/dashboard',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send test notification');
            }

            setSuccess('Test notification sent!');
        } catch (error: any) {
            setError(error.message || 'Failed to send test notification');
        } finally {
            setProcessing(false);
        }
    };

    if (!isSupported) {
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <NotificationsOffIcon color="disabled" />
                        <Typography variant="h6">Push Notifications</Typography>
                    </Box>
                    <Alert severity="warning">
                        Push notifications are not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <NotificationsIcon color={isSubscribed ? 'primary' : 'disabled'} />
                        <Typography variant="h6">Push Notifications</Typography>
                        {isSubscribed && (
                            <Chip label="Active" color="success" size="small" />
                        )}
                    </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                    Receive real-time notifications for transactions, approvals, and important updates even when you're not using the app.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                        {success}
                    </Alert>
                )}

                {permission === 'denied' && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Notifications are blocked. Please enable them in your browser settings.
                    </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isSubscribed}
                                onChange={handleToggleNotifications}
                                disabled={loading || processing || permission === 'denied'}
                            />
                        }
                        label={
                            loading ? 'Checking...' :
                            processing ? 'Processing...' :
                            isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'
                        }
                    />

                    {isSubscribed && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={sendTestNotification}
                            disabled={processing}
                            startIcon={processing ? <CircularProgress size={16} /> : <NotificationsIcon />}
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            Send Test Notification
                        </Button>
                    )}
                </Box>

                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        <strong>You'll receive notifications for:</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="ul" sx={{ pl: 2, m: 0 }}>
                        <li>New transactions in your department</li>
                        <li>Transaction approvals or rejections</li>
                        <li>Important system updates</li>
                        <li>Week lock notifications</li>
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
