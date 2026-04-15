// ◈ ShadowTalk Service Worker v2
const CACHE_NAME = 'shadowtalk-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push reçu ──────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: '◈ ShadowTalk', body: event.data?.text() || 'Nouveau message' }; }

  const options = {
    body:      data.body  || 'Nouveau message',
    icon:      '/icon-192.png',
    badge:     '/badge-72.png',
    tag:       data.chatId || 'shadowtalk',
    renotify:  true,
    silent:    false,
    vibrate:   [200, 100, 200, 100, 200], // ✅ Vibration pattern
    data:      { url: data.url || '/', chatId: data.chatId || null },
    actions: [
      { action: 'open',    title: '💬 Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
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
