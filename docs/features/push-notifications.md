# Push Notifications Setup

## Overview
This application uses Web Push Notifications to send real-time updates to users about transactions, approvals, and system events.

## Features
- **Push Notifications**: Real-time notifications for transaction approvals/rejections
- **PWA Support**: Full Progressive Web App with offline capabilities
- **Background Sync**: Automatic sync when connection is restored
- **Offline Page**: Custom offline experience

## Setup Instructions

### 1. Generate VAPID Keys
```bash
npm install web-push
node scripts/generate-vapid-keys.js
```

### 2. Add Keys to Environment
Create or update `.env.local` with the generated keys:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:admin@flc-ci.org
```

### 3. Update Database Schema
```bash
npx prisma db push
npx prisma generate
```

### 4. Test Notifications
1. Start the dev server: `npm run dev`
2. Login to the app
3. Enable notifications in the sidebar
4. Grant browser permission when prompted

## API Endpoints

### Subscribe to Notifications
**POST** `/api/notifications/subscribe`
```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Unsubscribe from Notifications
**DELETE** `/api/notifications/subscribe`
```json
{
  "endpoint": "https://..."
}
```

### Send Notifications (Admin Only)
**POST** `/api/notifications/send`
```json
{
  "userIds": ["user1", "user2"],
  "notification": {
    "title": "Transaction Approved",
    "body": "Your expense request has been approved",
    "url": "/transactions",
    "icon": "/icon-192x192.png",
    "tag": "approval",
    "requireInteraction": false
  }
}
```

## Usage Example

### Send Notification on Transaction Approval
```typescript
// In approval endpoint
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userIds: [transaction.userId],
    notification: {
      title: 'Transaction Approved',
      body: `Your ${transaction.type} of ${formatCurrency(transaction.amount)} has been approved`,
      url: '/transactions',
      tag: 'approval',
    },
  }),
});
```

## Service Worker

The custom service worker (`public/sw.js`) handles:
- **Caching**: Static and dynamic assets
- **Push Events**: Receiving and displaying notifications
- **Background Sync**: Syncing pending transactions when online
- **Offline Support**: Serving cached content when offline

## Components

### PushNotificationManager
Located in `src/components/PushNotificationManager.tsx`
- Displays in sidebar below header
- Toggle switch to enable/disable notifications
- Handles permission requests
- Manages subscriptions

## Browser Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ⚠️ Limited (iOS 16.4+)
- Opera: ✅ Full support

## Security Notes
- VAPID private key must be kept secret
- Never commit `.env.local` to version control
- Subscriptions are tied to user accounts
- Only admins can send notifications
- Subscriptions auto-expire and are cleaned up

## Troubleshooting

### Notifications not working
1. Check browser console for errors
2. Verify VAPID keys are set in `.env.local`
3. Ensure service worker is registered
4. Check browser notification permissions

### Service worker not updating
1. Hard refresh: Ctrl+Shift+R / Cmd+Shift+R
2. Clear cache and reload
3. Unregister service worker in DevTools

### Database errors
```bash
npx prisma db push
npx prisma generate
```

## Production Deployment

1. Generate production VAPID keys
2. Add keys to production environment variables
3. Ensure HTTPS is enabled (required for service workers)
4. Test notifications in production environment
5. Monitor subscription cleanup and errors
