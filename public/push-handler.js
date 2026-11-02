// Service Worker Push Notification Handler for MadHata

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      data = { title: '🎬 MadHata', body: event.data ? event.data.text() : 'New recommendations for you!' };
    } catch (_) {
      data = { title: '🎬 MadHata', body: 'New free movies & short dramas waiting for you!' };
    }
  }

  const title = data.title || '🎬 MadHata Recommendation';
  const options = {
    body: data.body || 'Stream free movies & short dramas with no ads!',
    icon: data.icon || 'https://i.ibb.co/DDbzq5nG/Meta-AI-882313168-4033689700101698-2768700689194481107-n-20261101-055728-webp.jpg',
    badge: '/pwa-192.png',
    image: data.image || undefined,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    vibrate: [150, 60, 150],
    actions: [
      { action: 'watch', title: 'Watch Now' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
