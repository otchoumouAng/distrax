const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstNonEmptyString(...values) {
    const value = values.find(item => typeof item === 'string' && item.trim());
    return value ? value.trim() : '';
}

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

/**
 * Normalise les différents formats reçus depuis Firebase : message au premier
 * plan, notification créée par Dystrax ou notification générée par le SDK FCM.
 */
export function extractPushData(payload = {}) {
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
        notification_id: firstNonEmptyString(
            data.notification_id,
            data.event_id,
            root.notification_id,
            fcmData.notification_id,
            fcmData.event_id,
        ),
        title: firstNonEmptyString(data.title, notification.title, fcmNotification.title),
        body: firstNonEmptyString(data.body, notification.body, fcmNotification.body),
    };
}

export function isValidDesireId(value) {
    return UUID_PATTERN.test(String(value || '').trim());
}

function desireIdFromUrl(url) {
    const match = url.hash.match(/^#desire\/([0-9a-f-]{36})(?:[?&].*)?$/i);
    return match && isValidDesireId(match[1]) ? match[1] : '';
}

/**
 * Retourne une destination de même origine. Une URL externe fournie dans un
 * payload est ignorée afin qu'une notification ne devienne pas un open redirect.
 */
export function resolvePushTarget(payload, origin) {
    const data = extractPushData(payload);
    const safeOrigin = new URL(origin).origin;
    const desireId = isValidDesireId(data.desire_id) ? data.desire_id : '';
    const notificationId = isValidDesireId(data.notification_id) ? data.notification_id : '';

    if (data.url) {
        try {
            const candidate = new URL(data.url, `${safeOrigin}/`);
            if (candidate.origin === safeOrigin) {
                return {
                    data,
                    type: data.type,
                    desireId: desireId || desireIdFromUrl(candidate),
                    notificationId,
                    url: candidate.href,
                };
            }
        } catch {
            // Repli vers desire_id ci-dessous.
        }
    }

    if (desireId) {
        return {
            data,
            type: data.type,
            desireId,
            notificationId,
            url: new URL(`/#desire/${desireId}`, safeOrigin).href,
        };
    }

    return {
        data,
        type: data.type,
        desireId: '',
        notificationId,
        url: new URL('/', safeOrigin).href,
    };
}

/**
 * Action attendue après ouverture de l'envie, par type de notification.
 * Chaque entrée du catalogue éditorial (§12.2) est listée explicitement ;
 * une valeur null signifie « ouvrir l'envie sans cible de focalisation ».
 */
const NOTIFICATION_FOCUS = {
    join_request: 'participant-requests',   // Nouvelle demande → répondre
    join_accepted: 'confirm-presence',      // Acceptation → confirmer ma présence
    join_rejected: null,                    // Refus → voir d'autres envies
    presence_confirm: 'confirm-presence',   // Présence à confirmer → je confirme
    organizer_keep: null,                   // Maintien organisateur
    reminder_day: 'practical-info',         // Rappel veille → détails pratiques
    reminder_soon: 'practical-info',        // Rappel imminent → lieu / itinéraire
    desire_updated: 'practical-info',       // Modification → champs modifiés
    desire_cancelled: null,                 // Annulation → état annulé
    post_activity: null,                    // Après activité → retour
    republish: null,                        // Republication → reprogrammer
    recommendation: null,                   // Recommandation → découvrir
    new_desire: null,                       // Nouvelle envie
};

/** Retourne la cible de focalisation associée à un type, ou null. */
export function getNotificationFocus(type) {
    const key = typeof type === 'string' ? type.trim() : '';
    return NOTIFICATION_FOCUS[key] || null;
}

export function isParticipantRequestNotification(type) {
    return getNotificationFocus(type) === 'participant-requests';
}
