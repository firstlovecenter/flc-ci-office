// Custom Service Worker for CI Office
// Handles push notifications, caching, and offline support

const CACHE_NAME = 'flc-ci-office-v3';
const STATIC_CACHE = 'flc-static-v3';
const DYNAMIC_CACHE = 'flc-dynamic-v3';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => {
      console.error('[SW] Failed to cache static assets:', err);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and immediately claim all clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          if (cacheName === DYNAMIC_CACHE) {
            console.log('[SW] Purging dynamic cache to clear stale data');
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Claim all clients immediately so the new SW takes over without waiting
        // for a page reload, then reload all open pages to use fresh assets.
        return self.clients.claim().then(() => {
          return self.clients.matchAll({ type: 'window' }).then((clients) => {
            clients.forEach((client) => client.navigate(client.url));
          });
        });
      });
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - NEVER cache, always go to network
  // API responses contain user-specific data and must not be shared across sessions
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // If network fails, return a generic error response
        return new Response(JSON.stringify({ error: 'You are offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // HTML pages (navigation requests) - network first, then cache
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseClone = response.clone();
          // Cache successful responses
          if (response.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if available
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, show offline page
            return caches.match('/offline');
          });
        })
    );
    return;
  }

  // Next.js hashed static assets — always network first, never serve stale cache.
  // These URLs embed a content hash so a new deploy means new URLs; a cached old
  // response would load fine but background chunks would 404 and break the app.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          // Return cached copy as last resort; if none, return a proper error response
          // instead of undefined (undefined causes "Failed to convert value to 'Response'")
          return cachedResponse || new Response('Chunk unavailable offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Other static assets - cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background
        fetch(request).then((response) => {
          if (response.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        const responseClone = response.clone();
        if (response.status === 200) {
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
          return caches.match('/offline');
        }
        // Must return a Response — undefined causes SW crash
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
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
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event (for offline transaction submissions)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

// Sync pending transactions when back online
async function syncTransactions() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    const pendingRequests = requests.filter(req => req.url.includes('/api/transactions') && req.method === 'POST');
    
    for (const request of pendingRequests) {
      try {
        await fetch(request.clone());
        await cache.delete(request);
      } catch (error) {
        console.error('[SW] Failed to sync transaction:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(urls);
      })
    );
  }
});
