import { beforeEach, describe, expect, it } from 'vitest';

import {
    ORGANIZER_PAYMENTS_TARGET_KEY,
    SCAN_TARGET_KEY,
    clearOrganizerTarget,
    fundsStatusLabel,
    isPlatformPaidDesire,
    normalizeScanInput,
    paymentStatusLabel,
    readOrganizerTarget,
    rememberOrganizerTarget,
    scanErrorMessage,
    ticketStatusLabel,
} from './organizerView.js';

function createStorage() {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
}

beforeEach(() => {
    globalThis.window = { sessionStorage: createStorage() };
});

describe('libellés organisateur (ORG-02 / ORG-05)', () => {
    it('traduit les statuts de paiement', () => {
        expect(paymentStatusLabel('pending')).toBe('Paiement en attente');
        expect(paymentStatusLabel('succeeded')).toBe('Paiement reçu');
        expect(paymentStatusLabel('failed')).toBe('Paiement échoué');
        expect(paymentStatusLabel('unknown')).toBe('Paiement à vérifier');
    });

    it('traduit les statuts de fonds', () => {
        expect(fundsStatusLabel('pending')).toBe('Fonds en attente');
        expect(fundsStatusLabel('available')).toBe('Net débloqué');
        expect(fundsStatusLabel('held')).toBe('Fonds retenus');
    });

    it('traduit les statuts de billet', () => {
        expect(ticketStatusLabel('active')).toBe('Billet actif');
        expect(ticketStatusLabel('checked_in')).toBe('Entrée validée');
        expect(ticketStatusLabel('void')).toBe('Billet invalidé');
    });

    it('reste lisible sur un statut inconnu ou absent', () => {
        expect(paymentStatusLabel('refunded')).toBe('refunded');
        expect(fundsStatusLabel(undefined)).toBe('—');
        expect(ticketStatusLabel(null)).toBe('—');
    });
});

describe('éligibilité au parcours organisateur', () => {
    it('reconnaît une envie payante encaissée par la plateforme', () => {
        expect(isPlatformPaidDesire({
            payment_policy: 'platform_required',
            price_type: 'paid',
        })).toBe(true);
    });

    it('écarte gratuit, contribution et organisateur encaisseur', () => {
        expect(isPlatformPaidDesire({ payment_policy: 'free', price_type: 'paid' })).toBe(false);
        expect(isPlatformPaidDesire({ payment_policy: 'platform_required', price_type: 'contribution' })).toBe(false);
        expect(isPlatformPaidDesire({ payment_policy: 'organizer', price_type: 'paid' })).toBe(false);
        expect(isPlatformPaidDesire(null)).toBe(false);
        expect(isPlatformPaidDesire(undefined)).toBe(false);
    });
});

describe('saisie au scanner (ORG-03 / ORG-04)', () => {
    it('reconnaît un code de secours à 8 chiffres', () => {
        expect(normalizeScanInput('12345678')).toEqual({ kind: 'backup_code', value: '12345678' });
        expect(normalizeScanInput('  12345678  ')).toEqual({ kind: 'backup_code', value: '12345678' });
    });

    it('reconnaît un jeton QR textuel', () => {
        expect(normalizeScanInput('tok_abc-DEF')).toEqual({ kind: 'qr_token', value: 'tok_abc-DEF' });
        expect(normalizeScanInput('1234567')).toEqual({ kind: 'qr_token', value: '1234567' });
        expect(normalizeScanInput('123456789')).toEqual({ kind: 'qr_token', value: '123456789' });
    });

    it('refuse une saisie vide', () => {
        expect(normalizeScanInput('')).toEqual({ kind: null, value: '' });
        expect(normalizeScanInput('   ')).toEqual({ kind: null, value: '' });
        expect(normalizeScanInput(null)).toEqual({ kind: null, value: '' });
    });
});

describe('messages de refus du scan (ORG-04)', () => {
    it('affiche un message dédié au double scan sans second crédit', () => {
        expect(scanErrorMessage({ code: 'ALREADY_SCANNED' })).toBe('Billet déjà validé.');
    });

    it('couvre les refus métier du contrat', () => {
        expect(scanErrorMessage({ code: 'WRONG_EVENT' })).toBe('Ce billet appartient à une autre envie.');
        expect(scanErrorMessage({ code: 'TICKET_VOID' })).toContain('invalidé');
        expect(scanErrorMessage({ code: 'SCAN_WINDOW_CLOSED' })).toContain('fermé');
        expect(scanErrorMessage({ code: 'FUNDS_HELD' })).toContain('litige');
        expect(scanErrorMessage({ code: 'PAYMENT_PENDING' })).toContain('pas encore confirmé');
        expect(scanErrorMessage({ code: 'BACKUP_CODE_UNAVAILABLE' })).toContain('plus valable');
        expect(scanErrorMessage({ code: 'TICKET_NOT_FOUND' })).toContain('introuvable');
    });

    it('retombe sur le message serveur puis sur un message par défaut', () => {
        expect(scanErrorMessage({ code: 'UNKNOWN_CODE', message: 'Erreur réseau' })).toBe('Erreur réseau');
        expect(scanErrorMessage({})).toBe('Impossible de valider ce billet. Réessayez.');
        expect(scanErrorMessage(null)).toBe('Impossible de valider ce billet. Réessayez.');
    });
});

describe('cible mémorisée entre navigation et montage', () => {
    it('mémorise puis relit l’envie ciblée', () => {
        rememberOrganizerTarget(SCAN_TARGET_KEY, 'desire-1');
        expect(readOrganizerTarget(SCAN_TARGET_KEY)).toBe('desire-1');
        expect(readOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY)).toBeNull();
    });

    it('efface la cible sur demande', () => {
        rememberOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY, 'desire-2');
        clearOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY);
        expect(readOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY)).toBeNull();
    });

    it('ignore un stockage indisponible', () => {
        globalThis.window = {};
        expect(() => rememberOrganizerTarget(SCAN_TARGET_KEY, 'desire-3')).not.toThrow();
        expect(readOrganizerTarget(SCAN_TARGET_KEY)).toBeNull();
    });
});
