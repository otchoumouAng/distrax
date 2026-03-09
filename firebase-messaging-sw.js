/**
 * firebase-messaging-sw.js — Service Worker FCM pour Distrax
 * Placé à la racine du projet (même niveau que index.html).
 *
 * Ce fichier doit être servi depuis l'origine exacte de l'application.
 * Firebase utilisera ce SW pour afficher les notifications push en background.
 *
 * ⚠️  Remplacez les valeurs ci-dessous par votre config Firebase réelle.
 *     Obtenez-les depuis : https://console.firebase.google.com → Paramètres du projet
 */

// ── Import du SDK Firebase ────────────────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── Configuration Firebase ────────────────────────────────────────────────────
// TODO : Remplacer ces valeurs par votre propre projet Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Notification en background ────────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notification reçue en background:', payload);

    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    // Affichage de la notification système
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

// ── Clic sur la notification ──────────────────────────────────────────────────
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
