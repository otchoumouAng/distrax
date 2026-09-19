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
                    actionTarget: data.action_target,
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
            actionTarget: data.action_target,
            url: new URL(`/#desire/${desireId}`, safeOrigin).href,
        };
    }

    return {
        data,
        type: data.type,
        desireId: '',
        notificationId,
        actionTarget: data.action_target,
        url: new URL('/', safeOrigin).href,
    };
}

/**
 * Appel à l'action unique de chaque événement (CDC §11, §12.1).
 *
 * `label` est le libellé du bouton, `target` l'étape à ouvrir dans
 * l'application — jamais une action exécutée d'office. L'API porte ces valeurs
 * (`action_label` / `action_target`) ; cette table n'est qu'un repli pour les
 * notifications envoyées avant leur mise en place et pour les types émis
 * uniquement côté client.
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

/** Retourne l'action portée par un type de notification, ou null. */
export function getNotificationAction(type) {
    const key = typeof type === 'string' ? type.trim() : '';
    return NOTIFICATION_ACTIONS[key] || null;
}

/**
 * Action à proposer pour une notification, un push ou un type.
 *
 * L'API est la source de vérité (`action_label` / `action_target`) ; la table
 * locale ne sert que de repli. Retourne null lorsqu'aucune action n'est
 * connue, afin que chaque surface puisse simplement ne rien afficher.
 */
export function resolveNotificationAction(source = {}) {
    if (typeof source === 'string') return getNotificationAction(source);

    const value = asObject(source);
    const label = firstNonEmptyString(value.action_label, value.actionLabel);
    if (label) {
        return { label, target: firstNonEmptyString(value.action_target, value.actionTarget) };
    }
    return getNotificationAction(value.type);
}

/**
 * Étape à ouvrir après l'ouverture de l'envie, par type de notification.
 * Une valeur null signifie « ouvrir l'envie sans étape à mettre en avant ».
 */
export function getNotificationFocus(type) {
    const action = getNotificationAction(type);
    return (action && action.target) || null;
}

export function isParticipantRequestNotification(type) {
    return getNotificationFocus(type) === 'participant-requests';
}
