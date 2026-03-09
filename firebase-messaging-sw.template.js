/**
 * firebase-messaging-sw.js — Service Worker FCM pour Distrax
 * Généré par scripts/inject-firebase-sw.cjs à partir de .env.dev / .env.prod
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "__FIREBASE_API_KEY__",
    authDomain: "__FIREBASE_AUTH_DOMAIN__",
    projectId: "__FIREBASE_PROJECT_ID__",
    storageBucket: "__FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
    appId: "__FIREBASE_APP_ID__",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notification reçue en background:', payload);
    const { title, body } = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(title || 'Distrax', {
        body: body || 'Vous avez une nouvelle notification.',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-72.png',
        data,
        vibrate: [200, 100, 200],
        tag: data.type || 'distrax-notif',
        requireInteraction: false,
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    let url = '/';
    if (data.type === 'desire_joined') {
        url = '/#profile';
    } else if (data.type === 'boost_nearby' && data.desire_id) {
        url = `/#desire/${data.desire_id}`;
    }
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
