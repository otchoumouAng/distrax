/* global firebase */

const DESIRE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function firstNonEmptyString(...values) {
    const value = values.find(item => typeof item === 'string' && item.trim());
    return value ? value.trim() : '';
}

function extractPushData(payload = {}) {
    const root = asObject(payload);
    const rootData = asObject(root.data);
    const fcmMessage = asObject(root.FCM_MSG || rootData.FCM_MSG);
    const fcmData = asObject(fcmMessage.data);
    const notification = asObject(root.notification);
    const fcmNotification = asObject(fcmMessage.notification);
    const fcmOptions = asObject(root.fcmOptions || root.fcm_options || fcmMessage.fcmOptions);
    const data = Object.keys(fcmData).length > 0
        ? fcmData
        : (Object.keys(rootData).length > 0 && !rootData.FCM_MSG ? rootData : root);

    return {
        ...data,
        type: firstNonEmptyString(data.type, root.type, fcmData.type),
        desire_id: firstNonEmptyString(
            data.desire_id,
            data.desireId,
            root.desire_id,
            root.desireId,
            fcmData.desire_id,
            fcmData.desireId,
        ),
        url: firstNonEmptyString(
            data.url,
            data.destination,
            data.link,
            data.click_action,
            root.url,
            root.destination,
            fcmOptions.link,
        ),
        title: firstNonEmptyString(data.title, notification.title, fcmNotification.title),
        body: firstNonEmptyString(data.body, notification.body, fcmNotification.body),
    };
}

function resolveTargetUrl(data) {
    const desireId = DESIRE_ID_PATTERN.test(data.desire_id || '') ? data.desire_id : '';
    let target;

    if (data.url) {
        try {
            const candidate = new URL(data.url, self.location.origin);
            if (candidate.origin === self.location.origin) target = candidate;
        } catch {
            // Repli vers desire_id ci-dessous.
        }
    }

    if (!target && desireId) {
        target = new URL(`/#desire/${desireId}`, self.location.origin);
    }
    if (!target) target = new URL('/', self.location.origin);

    // Au lancement à froid, aucun postMessage ne peut transporter le type ni
    // l'identifiant de notification. Les conserver dans le hash permet
    // d'ouvrir directement les demandes d'un organisateur et de journaliser
    // l'ouverture de la notification (PUS-11).
    const notificationId = firstNonEmptyString(data.notification_id, data.event_id);
    const hasValidNotificationId = DESIRE_ID_PATTERN.test(notificationId);
    const hasValidType = /^[a-z_]{1,64}$/i.test(data.type || '');

    if (/^#desire\/[0-9a-f-]{36}(?:\?.*)?$/i.test(target.hash) && (hasValidType || hasValidNotificationId)) {
        const [route, query = ''] = target.hash.split('?', 2);
        const params = new URLSearchParams(query);
        if (hasValidType) params.set('notification', data.type);
        if (hasValidNotificationId) params.set('notification_id', notificationId);
        target.hash = `${route}?${params}`;
    }

    return target.href;
}

/*
 * Le gestionnaire doit être enregistré avant l'import du SDK Firebase afin
 * que notre navigation profonde reste prioritaire pour tous les formats FCM.
 */
self.addEventListener('notificationclick', (event) => {
    event.stopImmediatePropagation();
    event.notification.close();

    const data = extractPushData(event.notification.data);
    const targetUrl = resolveTargetUrl(data);

    event.waitUntil((async () => {
        const windowClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });
        const existingClient = windowClients.find((client) => {
            try {
                return new URL(client.url).origin === self.location.origin;
            } catch {
                return false;
            }
        });

        if (existingClient) {
            await existingClient.focus();
            existingClient.postMessage({
                type: 'FCM_CLICK',
                data,
                url: targetUrl,
            });
            return;
        }

        await self.clients.openWindow(targetUrl);
    })());
});

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/*
 * Gestionnaire de requêtes minimal (PWA-01). Dystrax ne met rien en cache : le
 * réseau reste la source de vérité. Ce gestionnaire existe uniquement pour
 * satisfaire le critère d'installabilité de l'application web.
 */
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    // Aucun respondWith : le navigateur poursuit avec sa requête réseau habituelle.
});

importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

function readFirebaseConfig() {
    const params = new URL(self.location.href).searchParams;
    return {
        apiKey: params.get('apiKey') || '',
        projectId: params.get('projectId') || '',
        appId: params.get('appId') || '',
        messagingSenderId: params.get('messagingSenderId') || '',
    };
}

const firebaseConfig = readFirebaseConfig();
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

if (hasFirebaseConfig) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        // Les messages Dystrax sont data-only. Cette garde évite un double
        // affichage si un futur émetteur fournit malgré tout `notification`.
        if (payload.notification) return;

        const data = extractPushData(payload);
        const notificationOptions = {
            body: data.body || 'Une activité vient d’être mise à jour.',
            icon: '/assets/icons/icon-192.png',
            badge: '/assets/icons/icon-192.png',
            data: {
                ...data,
                url: resolveTargetUrl(data),
            },
        };

        if (data.event_id || data.notification_id) {
            notificationOptions.tag = `dystrax-${data.event_id || data.notification_id}`;
        }

        return self.registration.showNotification(data.title || 'Dystrax', notificationOptions);
    });
} else {
    console.warn('[firebase-messaging-sw] Configuration Firebase absente ou incomplète.');
}
