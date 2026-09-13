
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAFzvxNNpGCQZ9bi7Hv8h-ZdcMNgiRCwgU",
  authDomain: "hale-palisade-2pthm.firebaseapp.com",
  projectId: "hale-palisade-2pthm",
  storageBucket: "hale-palisade-2pthm.firebasestorage.app",
  messagingSenderId: "900700947514",
  appId: "1:900700947514:web:eda009340d95c6c7e8e103"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Papos';
  const body = payload.notification?.body || payload.data?.body || 'Tem gente conversando na sala.';
  const icon = payload.notification?.icon || payload.data?.icon || '/favicon-32x32.png';
  const roomId = payload.data?.roomId || 'room-1';
  const targetUrl = payload.data?.url || `https://papo.net.br/chat?room=${encodeURIComponent(roomId)}`;

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: '/favicon-16x16.png',
    data: {
      url: targetUrl,
      roomId: roomId,
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200],
    tag: `papos-room-${roomId}`,
    renotify: true
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const roomId = notifData.roomId || 'room-1';
  const targetUrl = notifData.url || `https://papo.net.br/chat?room=${encodeURIComponent(roomId)}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && (client.url.includes('/chat') || client.url.includes('/pages/chat.html')) && 'focus' in client) {
          if (roomId) {
            client.postMessage({
              action: 'JOIN_ROOM',
              roomId: roomId
            });
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
