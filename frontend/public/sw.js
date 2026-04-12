// ◈ ShadowTalk Service Worker
// Tourne en arrière-plan même quand l'appli est fermée

const CACHE_NAME = 'shadowtalk-v1';

// ─── Installation ───────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ─── Push reçu ──────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: '◈ ShadowTalk', body: event.data?.text() || 'Nouveau message' };
  }

  const title   = data.title || '◈ ShadowTalk';
  const options = {
    body:             data.body  || 'Nouveau message',
    icon:             data.icon  || '/icon-192.png',
    badge:            data.badge || '/badge-72.png',
    tag:              data.chatId || 'shadowtalk-notif',   // regroupe les notifs du même chat
    renotify:         true,
    silent:           false,
    vibrate:          [100, 50, 100],
    data: {
      url:    data.url    || '/',
      chatId: data.chatId || null
    },
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Clic sur la notification ────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    // Cherche si un onglet ShadowTalk est déjà ouvert
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Sinon ouvre un nouvel onglet
      return self.clients.openWindow(self.location.origin + targetUrl);
    })
  );
});

// ─── Notification fermée ─────────────────────────────────────
self.addEventListener('notificationclose', () => {
  // Analytics possible ici
});
