import { beforeAll, describe, expect, it, vi } from 'vitest';

let formatNotificationDate;
let getNotificationBodyText;
let getNotificationMeta;
let getNotificationNavigation;
let getNotificationViewModel;
let getRelatedDesireId;

beforeAll(async () => {
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define: vi.fn() };

    ({
        formatNotificationDate,
        getNotificationBodyText,
        getNotificationMeta,
        getNotificationNavigation,
        getNotificationViewModel,
        getRelatedDesireId,
    } = await import('./NotificationPage.js'));
});

describe('historique des notifications', () => {
    it('expose un libellé métier clair pour chaque type connu', () => {
        expect(getNotificationMeta('join_request').label).toBe('Nouvelle demande');
        expect(getNotificationMeta('join_accepted').label).toBe('Demande acceptée');
        expect(getNotificationMeta('join_rejected').label).toBe('Demande refusée');
        expect(getNotificationMeta('new_desire').label).toBe('Nouvelle envie');
        expect(getNotificationMeta('unknown').label).toBe('Information');
    });

    it('couvre les types du maintien et de l’annulation (ORG-08/10/11)', () => {
        expect(getNotificationMeta('organizer_keep').label).toBe('Maintien à confirmer');
        expect(getNotificationMeta('desire_updated').label).toBe('Modification importante');
        expect(getNotificationMeta('desire_cancelled').label).toBe('Activité annulée');
    });

    it('couvre les rappels avant activité (PAR-14/15)', () => {
        expect(getNotificationMeta('reminder_day').label).toBe('Rappel veille');
        expect(getNotificationMeta('reminder_soon').label).toBe('Départ bientôt');
        expect(getNotificationMeta('reminder_day').icon).toBe('event');
        expect(getNotificationMeta('reminder_soon').icon).toBe('directions_run');
    });

    it('conserve le titre, le corps, la date et l’état de lecture', () => {
        const view = getNotificationViewModel({
            type: 'join_request',
            title: 'Nouvelle demande',
            body: 'Awa souhaite participer.',
            created_at: '2026-09-11T12:30:00.000Z',
            is_read: false,
            related_desire_id: 'desire-42',
        });

        expect(view.title).toBe('Nouvelle demande');
        expect(view.body).toBe('Awa souhaite participer.');
        expect(view.isRead).toBe(false);
        expect(view.desireId).toBe('desire-42');
        expect(view.date.iso).toBe('2026-09-11T12:30:00.000Z');
        expect(view.date.label).toContain('2026');
    });

    it('fournit des valeurs compréhensibles pour les anciens enregistrements incomplets', () => {
        const view = getNotificationViewModel({
            type: 'join_accepted',
            message: 'Votre demande a été acceptée.',
            created_at: null,
            is_read: true,
        });

        expect(view.title).toBe('Demande acceptée');
        expect(view.body).toBe('Votre demande a été acceptée.');
        expect(view.isRead).toBe(true);
        expect(view.date).toEqual({ label: 'Date inconnue', iso: '' });
    });

    it('affiche explicitement une date invalide sans produire Invalid Date', () => {
        expect(formatNotificationDate('date-invalide')).toEqual({
            label: 'Date inconnue',
            iso: '',
        });
    });
});

describe('navigation vers une envie liée', () => {
    it('privilégie related_desire_id renvoyé par le schéma courant', () => {
        expect(getRelatedDesireId({
            related_desire_id: 'current-id',
            extra_data: { desire_id: 'legacy-id' },
        })).toBe('current-id');
    });

    it('reste compatible avec les anciennes formes de payload', () => {
        expect(getRelatedDesireId({ extra_data: { desire_id: 'legacy-snake' } })).toBe('legacy-snake');
        expect(getRelatedDesireId({ extra_data: { desireId: 'legacy-camel' } })).toBe('legacy-camel');
        expect(getRelatedDesireId({ desire_id: 'root-snake' })).toBe('root-snake');
        expect(getRelatedDesireId({ desireId: 'root-camel' })).toBe('root-camel');
    });

    it.each(['new_desire', 'desire_cancelled', 'future_type', 'recommendation'])(
        'ouvre toute notification liée sans cible connue, y compris le type %s',
        type => {
            expect(getNotificationNavigation({ type, related_desire_id: 'desire-42' })).toEqual({
                id: 'desire-42',
            });
        },
    );

    it.each([
        ['join_request', 'participant-requests'],
        ['join_accepted', 'confirm-presence'],
        ['presence_confirm', 'confirm-presence'],
        ['reminder_day', 'practical-info'],
        ['reminder_soon', 'practical-info'],
        ['desire_updated', 'practical-info'],
    ])('ouvre l’action exacte attendue pour le type %s', (type, focus) => {
        expect(getNotificationNavigation({ type, related_desire_id: 'desire-42' })).toEqual({
            id: 'desire-42',
            focus,
        });
    });

    it('ne crée pas de destination lorsque la notification n’est liée à aucune envie', () => {
        expect(getNotificationNavigation({ type: 'information' })).toBeNull();
    });

    it('privilégie l’étape transmise par l’API sur la table locale (CDC §11)', () => {
        expect(getNotificationNavigation({
            type: 'join_rejected',
            related_desire_id: 'desire-42',
            action_label: 'Répondre aux demandes',
            action_target: 'participant-requests',
        })).toEqual({
            id: 'desire-42',
            focus: 'participant-requests',
        });
    });

    it('ouvre l’envie sans étape lorsqu’un libellé est fourni sans cible', () => {
        expect(getNotificationNavigation({
            type: 'new_desire',
            related_desire_id: 'desire-42',
            action_label: 'Découvrir',
        })).toEqual({ id: 'desire-42' });
    });
});

describe('regroupement des demandes rapprochées (NIN-08)', () => {
    it('résume plusieurs demandes en un seul message', () => {
        expect(getNotificationBodyText({
            type: 'join_request',
            body: 'Awa souhaite rejoindre votre envie',
            extra_data: { pending_count: 3 },
        })).toBe('3 personnes souhaitent rejoindre votre envie.');
    });

    it('conserve le message d’origine pour une demande isolée', () => {
        expect(getNotificationBodyText({
            type: 'join_request',
            body: 'Awa souhaite rejoindre votre envie',
            extra_data: { pending_count: 1 },
        })).toBe('Awa souhaite rejoindre votre envie');
    });

    it('n’applique pas le regroupement aux autres types', () => {
        expect(getNotificationBodyText({
            type: 'join_accepted',
            body: 'Marc a accepté ta demande.',
            extra_data: { pending_count: 4 },
        })).toBe('Marc a accepté ta demande.');
    });

    it('propage le corps regroupé dans le view-model affiché', () => {
        const view = getNotificationViewModel({
            type: 'join_request',
            body: 'Awa souhaite rejoindre votre envie',
            extra_data: { pending_count: 2 },
            related_desire_id: 'desire-42',
        });
        expect(view.body).toBe('2 personnes souhaitent rejoindre votre envie.');
    });
});
