// ◈ ShadowTalk Service Worker v3
const CACHE_NAME  = 'shadowtalk-v3';
const PRECACHE    = ['/', '/manifest.json', '/icon-192.png', '/badge-72.png'];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch : Network first, cache fallback ──────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('socket.io')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push reçu ──────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: '◈ ShadowTalk', body: event.data?.text() || 'Nouveau message' };
  }

  const options = {
    body:     data.body   || 'Nouveau message',
    icon:     '/icon-192.png',
    badge:    '/badge-72.png',
    tag:      data.chatId || 'shadowtalk',
    renotify: true,
    silent:   false,
    vibrate:  [200, 100, 200],
    data: { url: data.url || '/', chatId: data.chatId || null },
    actions: [
      { action: 'open',    title: '💬 Ouvrir'  },
      { action: 'dismiss', title: '✕ Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '◈ ShadowTalk', options)
  );
});

// ── Clic notification ──────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        return self.clients.openWindow(self.location.origin + url);
      })
  );
});
