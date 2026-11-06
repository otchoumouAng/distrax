import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
    getPayment: vi.fn(),
    getBooking: vi.fn(),
    getJoinedDesires: vi.fn(),
}));

vi.mock('../api.js', () => ({ api: apiMocks }));

import {
    PENDING_PAYMENT_KEY,
    clearPendingPayment,
    findJoinedEntry,
    formatAmount,
    isPaidJourney,
    readPendingPayment,
    rememberPendingPayment,
    resumePendingPayment,
    verifyPendingPayment,
} from './paymentFlow.js';

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
    vi.clearAllMocks();
});

describe('parcours payant : éligibilité et montants (PAR-01)', () => {
    it('reconnaît une envie encaissée par la plateforme', () => {
        expect(isPaidJourney({
            payment_policy: 'platform_required',
            price_type: 'paid',
            pay_mode: 'they_pay',
            price_amount: 5000,
            currency: 'XOF',
        })).toBe(true);
    });

    it('écarte les parcours gratuit, contribution et organisateur encaisseur', () => {
        expect(isPaidJourney({ payment_policy: 'free', price_type: 'paid', pay_mode: 'they_pay', price_amount: 5000 })).toBe(false);
        expect(isPaidJourney({ payment_policy: 'platform_required', price_type: 'contribution', pay_mode: 'they_pay', price_amount: 5000 })).toBe(false);
        expect(isPaidJourney({ payment_policy: 'platform_required', price_type: 'paid', pay_mode: 'i_pay', price_amount: 5000 })).toBe(false);
        expect(isPaidJourney({ payment_policy: 'platform_required', price_type: 'paid', pay_mode: 'they_pay', price_amount: null })).toBe(false);
        expect(isPaidJourney({ payment_policy: 'platform_required', price_type: 'paid', pay_mode: 'they_pay', price_amount: 5000, currency: 'EUR' })).toBe(false);
    });

    it('affiche le prix total en FCFA', () => {
        // `toLocaleString` peut utiliser une espace insécable étroite.
        const normalize = (value) => value.replace(/[\u202f\u00a0]/g, ' ');
        expect(normalize(formatAmount(5000))).toBe('5 000 FCFA');
        expect(formatAmount(0)).toBe('0 FCFA');
        expect(formatAmount('abc')).toBe('—');
    });
});

describe('mémoire du paiement en attente (PAR-02)', () => {
    it('mémorise la tentative puis l’efface', () => {
        rememberPendingPayment({ paymentId: 'pay-1', bookingId: 'book-1', desireId: 'desire-1' });
        expect(readPendingPayment()).toMatchObject({
            paymentId: 'pay-1',
            bookingId: 'book-1',
            desireId: 'desire-1',
        });

        clearPendingPayment({ paymentId: 'pay-1' });
        expect(readPendingPayment()).toBeNull();
    });

    it('ne vérifie rien sans tentative mémorisée', async () => {
        expect(await resumePendingPayment()).toBeNull();
        expect(apiMocks.getPayment).not.toHaveBeenCalled();
    });

    it('abandonne une tentative trop ancienne sans interroger le serveur', async () => {
        window.sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
            paymentId: 'pay-old',
            created_at: Date.now() - 25 * 60 * 60 * 1000,
        }));

        expect(await resumePendingPayment()).toBeNull();
        expect(apiMocks.getPayment).not.toHaveBeenCalled();
        expect(readPendingPayment()).toBeNull();
    });

    it('interroge le serveur jusqu’au statut définitif', async () => {
        apiMocks.getPayment
            .mockResolvedValueOnce({ status: 'pending' })
            .mockResolvedValueOnce({ status: 'succeeded' });

        const payment = await verifyPendingPayment(
            { paymentId: 'pay-1' },
            { attempts: 3, delayMs: 0 },
        );

        expect(payment.status).toBe('succeeded');
        expect(apiMocks.getPayment).toHaveBeenCalledTimes(2);
    });

    it('ne conclut jamais au succès sur le seul retour navigateur', async () => {
        rememberPendingPayment({ paymentId: 'pay-1' });
        apiMocks.getPayment.mockResolvedValue({ status: 'pending' });

        const result = await resumePendingPayment();
        expect(result.outcome).toBe('pending');
        expect(readPendingPayment()).not.toBeNull();
    }, 15000);

    it('reprend un paiement confirmé et libère la mémoire', async () => {
        rememberPendingPayment({ paymentId: 'pay-1', bookingId: 'book-1', desireId: 'desire-1' });
        apiMocks.getPayment.mockResolvedValue({ status: 'succeeded', booking_id: 'book-1' });
        apiMocks.getBooking.mockResolvedValue({ id: 'book-1', status: 'confirmed' });

        const result = await resumePendingPayment();
        expect(result.outcome).toBe('succeeded');
        expect(result.booking.status).toBe('confirmed');
        expect(readPendingPayment()).toBeNull();
    });

    it('signale un paiement refusé et libère la mémoire', async () => {
        rememberPendingPayment({ paymentId: 'pay-1' });
        apiMocks.getPayment.mockResolvedValue({ status: 'failed' });

        const result = await resumePendingPayment();
        expect(result.outcome).toBe('failed');
        expect(readPendingPayment()).toBeNull();
    });
});

describe('retrouver la participation payante (PAR-03/PAR-04)', () => {
    it('retrouve l’entrée jointe par identifiant d’envie', async () => {
        apiMocks.getJoinedDesires.mockResolvedValue([
            { id: 'desire-1', booking_id: 'book-1', status: 'confirmed' },
        ]);

        expect(await findJoinedEntry('desire-1')).toMatchObject({ booking_id: 'book-1' });
        expect(await findJoinedEntry('desire-2')).toBeNull();
        expect(await findJoinedEntry('')).toBeNull();
    });
});
