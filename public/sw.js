const CACHE_NAME = 'luphonix-pwa-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install: Cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API and code assets, Cache-first for media
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If API request, go network-first
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ offline: true, error: 'Offline network mode' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-first for HTML and JS logic so cloud sync updates apply immediately
  if (url.pathname === '/app.js' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: Cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// =======================================================================
// SYSTEM PUSH NOTIFICATIONS (Phone Locked / Screen Off / On / App Closed)
// =======================================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'Luphonix — Task Assigned',
    body: 'You have been assigned a new task in Luphonix.',
    icon: '/icons/apple-touch-icon.png',
    badge: '/icons/icon-192.png',
    data: { url: '/?view=tasks' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const title = data.title || 'Luphonix Task Alert';
  const options = {
    body: data.body,
    icon: data.icon || '/icons/apple-touch-icon.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || `luphonix-task-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: data.data || { url: '/?view=tasks' },
    actions: [
      { action: 'view', title: 'Open Task' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle User Tap / Click on the Push Notification Banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/?view=tasks';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            url: targetUrl,
            data: event.notification.data
          });
          return client.focus();
        }
      }
      // If no window open, launch a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

