// MadHata Service Worker & Push Notification Receiver

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification event listener
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { title: '🎬 MadHata', body: event.data.text() };
      } catch (_) {
        data = { title: '🎬 MadHata', body: 'New recommendations ready for you!' };
      }
    }
  }

  const title = data.title || '🎬 MadHata';
  const options = {
    body: data.body || 'New stream ready to watch on MadHata with zero ads!',
    icon: data.icon || 'https://i.ibb.co/DDbzq5nG/Meta-AI-882313168-4033689700101698-2768700689194481107-n-20261101-055728-webp.jpg',
    badge: '/pwa-192.png',
    image: data.image || undefined,
    tag: 'madhata-alert-' + (data.tag || Date.now()),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'watch', title: 'Watch Now' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
