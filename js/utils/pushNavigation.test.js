import { describe, expect, it } from 'vitest';

import {
    extractPushData,
    getNotificationAction,
    getNotificationFocus,
    getPageTarget,
    isPageTarget,
    isParticipantRequestNotification,
    isValidDesireId,
    resolveNotificationAction,
    resolvePushTarget,
} from './pushNavigation.js';

const DESIRE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORIGIN = 'https://dystrax.com';

describe('extractPushData', () => {
    it('normalise le payload data-only envoyé par le backend', () => {
        expect(extractPushData({
            data: {
                type: 'join_request',
                desire_id: DESIRE_ID,
                destination: `${ORIGIN}/#desire/${DESIRE_ID}`,
                title: 'Nouvelle demande',
                body: 'Awa souhaite participer.',
            },
        })).toMatchObject({
            type: 'join_request',
            desire_id: DESIRE_ID,
            url: `${ORIGIN}/#desire/${DESIRE_ID}`,
            title: 'Nouvelle demande',
            body: 'Awa souhaite participer.',
        });
    });

    it('lit les données imbriquées dans une notification générée par FCM', () => {
        expect(extractPushData({
            FCM_MSG: {
                data: { type: 'join_accepted', desire_id: DESIRE_ID },
                notification: { title: 'Acceptée', body: 'Votre demande est acceptée.' },
                fcmOptions: { link: `${ORIGIN}/#desire/${DESIRE_ID}` },
            },
        })).toMatchObject({
            type: 'join_accepted',
            desire_id: DESIRE_ID,
            url: `${ORIGIN}/#desire/${DESIRE_ID}`,
            title: 'Acceptée',
            body: 'Votre demande est acceptée.',
        });
    });

    it('expose l’identifiant de notification depuis event_id (PUS-11)', () => {
        expect(extractPushData({
            data: { type: 'join_request', desire_id: DESIRE_ID, event_id: DESIRE_ID },
        }).notification_id).toBe(DESIRE_ID);
    });

    it('expose l’appel à l’action du catalogue (CDC §11)', () => {
        expect(extractPushData({
            data: {
                type: 'join_request',
                desire_id: DESIRE_ID,
                action_label: 'Voir et répondre',
                action_target: 'participant-requests',
            },
        })).toMatchObject({
            action_label: 'Voir et répondre',
            action_target: 'participant-requests',
        });
    });
});

describe('resolvePushTarget', () => {
    it('construit le lien de l’envie depuis desire_id', () => {
        expect(resolvePushTarget({ desire_id: DESIRE_ID }, ORIGIN)).toMatchObject({
            desireId: DESIRE_ID,
            url: `${ORIGIN}/#desire/${DESIRE_ID}`,
        });
    });

    it('accepte une URL explicite seulement sur la même origine', () => {
        const sameOrigin = resolvePushTarget({
            desire_id: DESIRE_ID,
            url: `${ORIGIN}/#desire/${DESIRE_ID}`,
        }, ORIGIN);
        expect(sameOrigin.url).toBe(`${ORIGIN}/#desire/${DESIRE_ID}`);

        const external = resolvePushTarget({
            desire_id: DESIRE_ID,
            url: `https://example.com/#desire/${DESIRE_ID}`,
        }, ORIGIN);
        expect(external.url).toBe(`${ORIGIN}/#desire/${DESIRE_ID}`);
    });

    it('revient à l’accueil quand le payload ne contient aucune cible valide', () => {
        expect(resolvePushTarget({ desire_id: 'incorrect' }, ORIGIN)).toMatchObject({
            desireId: '',
            url: `${ORIGIN}/`,
        });
    });

    it('expose l’identifiant de notification à journaliser (PUS-11)', () => {
        const target = resolvePushTarget({
            data: { desire_id: DESIRE_ID, event_id: DESIRE_ID },
        }, ORIGIN);
        expect(target.notificationId).toBe(DESIRE_ID);

        const untrackable = resolvePushTarget({ desire_id: DESIRE_ID }, ORIGIN);
        expect(untrackable.notificationId).toBe('');
    });

    it('transporte l’étape d’action choisie jusqu’à l’application', () => {
        expect(resolvePushTarget({
            data: { desire_id: DESIRE_ID, action_target: 'confirm-presence' },
        }, ORIGIN).actionTarget).toBe('confirm-presence');

        expect(resolvePushTarget({
            data: {
                url: `${ORIGIN}/#desire/${DESIRE_ID}`,
                action_target: 'practical-info',
            },
        }, ORIGIN).actionTarget).toBe('practical-info');

        expect(resolvePushTarget({ desire_id: 'incorrect' }, ORIGIN).actionTarget).toBe('');
    });
});

describe('push notification helpers', () => {
    it('valide strictement les identifiants d’envie UUID', () => {
        expect(isValidDesireId(DESIRE_ID)).toBe(true);
        expect(isValidDesireId('../notifications')).toBe(false);
    });

    it('identifie les demandes à ouvrir sur les participants', () => {
        expect(isParticipantRequestNotification('join_request')).toBe(true);
        expect(isParticipantRequestNotification('join_accepted')).toBe(false);
    });

    it('associe chaque type du catalogue à son action attendue (NIN-06)', () => {
        expect(getNotificationFocus('join_request')).toBe('participant-requests');
        expect(getNotificationFocus('join_accepted')).toBe('confirm-presence');
        expect(getNotificationFocus('presence_confirm')).toBe('confirm-presence');
        expect(getNotificationFocus('reminder_day')).toBe('practical-info');
        expect(getNotificationFocus('reminder_soon')).toBe('practical-info');
        expect(getNotificationFocus('desire_updated')).toBe('practical-info');
    });

    it('route vers une page les actions qui ne visent pas une étape du détail', () => {
        expect(getNotificationFocus('join_rejected')).toBe('page:catalogue');
        expect(getNotificationFocus('new_desire')).toBe('page:catalogue');
        expect(getNotificationFocus('recommendation')).toBe('page:catalogue');
        expect(getNotificationFocus('republish')).toBe('page:create-republish');
        // Billet émis (PAR-04) : le push ouvre la page du billet personnel.
        expect(getNotificationFocus('ticket_issued')).toBe('page:ticket');
    });

    it('retourne null pour les types sans cible ou inconnus', () => {
        expect(getNotificationFocus('desire_cancelled')).toBeNull();
        expect(getNotificationFocus('post_activity')).toBeNull();
        expect(getNotificationFocus('type_inconnu')).toBeNull();
        expect(getNotificationFocus(undefined)).toBeNull();
    });
});

describe('cibles « page: » (CDC §11)', () => {
    it('reconnaît une page et en extrait le nom', () => {
        expect(isPageTarget('page:catalogue')).toBe(true);
        expect(getPageTarget('page:create-republish')).toBe('create-republish');
    });

    it('ne confond pas une ancre du détail avec une page', () => {
        expect(isPageTarget('participant-requests')).toBe(false);
        expect(getPageTarget('participant-requests')).toBe('');
        expect(isPageTarget('')).toBe(false);
        expect(isPageTarget(undefined)).toBe(false);
    });
});

describe('appel à l’action unique (CDC §11)', () => {
    it('associe chaque type connu à son libellé et son étape', () => {
        expect(getNotificationAction('join_request')).toEqual({
            label: 'Voir et répondre',
            target: 'participant-requests',
        });
        expect(getNotificationAction('join_accepted')).toEqual({
            label: 'Confirmer ma présence',
            target: 'confirm-presence',
        });
        expect(getNotificationAction('new_desire')).toEqual({ label: 'Découvrir', target: 'page:catalogue' });
        expect(getNotificationAction('republish')).toEqual({ label: 'Reprogrammer', target: 'page:create-republish' });
        expect(getNotificationAction('dormant_user')).toEqual({ label: 'Publier une envie', target: 'page:create' });
        expect(getNotificationAction('popular_desire')).toEqual({ label: "Voir l'envie", target: 'practical-info' });
    });

    it('ne propose aucune action pour un type inconnu ou sans action', () => {
        expect(getNotificationAction('type_inconnu')).toBeNull();
        expect(getNotificationAction('post_activity')).toBeNull();
        expect(getNotificationAction(undefined)).toBeNull();
    });

    it('privilégie l’action portée par l’API sur la table de repli', () => {
        expect(resolveNotificationAction({
            type: 'join_request',
            action_label: 'Répondre maintenant',
            action_target: 'confirm-presence',
        })).toEqual({ label: 'Répondre maintenant', target: 'confirm-presence' });
    });

    it('accepte les clés camelCase des payloads FCM', () => {
        expect(resolveNotificationAction({
            actionLabel: 'Voir la modification',
            actionTarget: 'practical-info',
        })).toEqual({ label: 'Voir la modification', target: 'practical-info' });
    });

    it('retombe sur la table locale quand l’API ne fournit pas d’action', () => {
        expect(resolveNotificationAction({ type: 'reminder_soon' })).toEqual({
            label: "Voir l'itinéraire",
            target: 'practical-info',
        });
        expect(resolveNotificationAction('new_desire')).toEqual({ label: 'Découvrir', target: 'page:catalogue' });
    });

    it('retourne null lorsque aucune action n’est connue', () => {
        expect(resolveNotificationAction({ type: 'type_inconnu' })).toBeNull();
    });
});
