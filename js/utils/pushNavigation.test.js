import { describe, expect, it } from 'vitest';

import {
    extractPushData,
    getNotificationFocus,
    isParticipantRequestNotification,
    isValidDesireId,
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

    it('retourne null pour les types sans cible ou inconnus', () => {
        expect(getNotificationFocus('join_rejected')).toBeNull();
        expect(getNotificationFocus('desire_cancelled')).toBeNull();
        expect(getNotificationFocus('new_desire')).toBeNull();
        expect(getNotificationFocus('type_inconnu')).toBeNull();
        expect(getNotificationFocus(undefined)).toBeNull();
    });
});
