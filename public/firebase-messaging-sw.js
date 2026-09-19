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
        action_label: firstNonEmptyString(
            data.action_label,
            data.actionLabel,
            root.action_label,
            fcmData.action_label,
        ),
        action_target: firstNonEmptyString(
            data.action_target,
            data.actionTarget,
            root.action_target,
            fcmData.action_target,
        ),
        title: firstNonEmptyString(data.title, notification.title, fcmNotification.title),
        body: firstNonEmptyString(data.body, notification.body, fcmNotification.body),
    };
}

/*
 * Repli local de l'appel à l'action (CDC §11, §12.1). Le service worker ne peut
 * pas importer le module partagé : cette table ne sert que si l'API n'a pas
 * fourni `action_label`.
 */
const NOTIFICATION_ACTIONS = {
    join_request: { label: 'Voir et répondre', target: 'participant-requests' },
    join_accepted: { label: 'Confirmer ma présence', target: 'confirm-presence' },
    join_rejected: { label: "Voir d'autres envies", target: '' },
    presence_confirm: { label: 'Je confirme', target: 'confirm-presence' },
    organizer_keep: { label: "Maintenir l'activité", target: 'maintenance' },
    reminder_day: { label: 'Voir les détails', target: 'practical-info' },
    reminder_soon: { label: "Voir l'itinéraire", target: 'practical-info' },
    desire_updated: { label: 'Voir la modification', target: 'practical-info' },
    desire_cancelled: { label: "Voir d'autres envies", target: '' },
    post_activity: { label: 'Donner mon retour', target: '' },
    republish: { label: 'Reprogrammer', target: '' },
    recommendation: { label: 'Découvrir', target: '' },
    new_desire: { label: 'Découvrir', target: '' },
};

const ACTION_BUTTON_ID = 'cta';

function resolveNotificationAction(data = {}) {
    const label = firstNonEmptyString(data.action_label, data.actionLabel);
    if (label) {
        return { label, target: firstNonEmptyString(data.action_target, data.actionTarget) };
    }
    const type = firstNonEmptyString(data.type);
    return (type && NOTIFICATION_ACTIONS[type]) || null;
}

function resolveTargetUrl(data, actionTarget = '') {
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
        // L'étape choisie par un bouton natif doit survivre à l'ouverture d'une
        // nouvelle fenêtre : elle voyage donc dans le hash comme le type.
        if (actionTarget) params.set('notification_action', actionTarget);
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
    // Un bouton natif vaut choix explicite de l'étape à ouvrir ; le clic sur le
    // corps de la notification reste l'ouverture par défaut.
    const action = resolveNotificationAction(data);
    const actionTarget = event.action === ACTION_BUTTON_ID && action ? action.target : '';
    const targetUrl = resolveTargetUrl(data, actionTarget);

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
                data: actionTarget ? { ...data, action_target: actionTarget } : data,
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
            icon: '/assets/icons/icon-192-v2.png',
            badge: '/assets/icons/icon-192-v2.png',
            data: {
                ...data,
                url: resolveTargetUrl(data),
            },
        };

        if (data.event_id || data.notification_id) {
            notificationOptions.tag = `dystrax-${data.event_id || data.notification_id}`;
        }

        // Bouton natif portant le libellé de l'action unique (CDC §11) : le clic
        // ouvre l'étape de confirmation, il ne l'exécute pas.
        const action = resolveNotificationAction(data);
        if (action && action.label) {
            notificationOptions.actions = [{ action: ACTION_BUTTON_ID, title: action.label }];
        }

        return self.registration.showNotification(data.title || 'Dystrax', notificationOptions);
    });
} else {
    console.warn('[firebase-messaging-sw] Configuration Firebase absente ou incomplète.');
}
