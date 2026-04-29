// Custom Service Worker for CI Office
// Scope: push notifications and an offline fallback for navigation only.
// We deliberately do NOT intercept static assets or cache HTML — Next.js
// chunks are immutable hashed URLs and HTTP cache headers are sufficient.
// Aggressive SW caching previously caused stale-chunk loops across deploys.

const CACHE_VERSION = 'v4';
const OFFLINE_CACHE = `flc-offline-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        '/manifest.json',
        '/icon-192x192.png',
        '/icon-512x512.png',
      ].map((url) => new Request(url, { cache: 'reload' })))
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== OFFLINE_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Only intercept top-level navigations; if the network fails, show /offline.
// All other requests (static chunks, images, API) pass straight through to
// the browser and are governed by their HTTP cache headers.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE }).then(
        (cached) => cached || new Response('Offline', { status: 503 })
      )
    )
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'CI Office',
    body: 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'default',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/', timestamp: Date.now() },
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
