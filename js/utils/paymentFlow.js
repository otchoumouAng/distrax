/**
 * Parcours participant payant (PAR-01 à PAR-05).
 *
 * Ce module ne décide jamais du résultat d'un paiement : le retour CinetPay
 * n'est qu'un signal de reprise. La seule source de vérité reste
 * `GET /payments/{id}`, interrogé après le retour et à chaque reconnexion.
 */

export const PENDING_PAYMENT_KEY = 'distrax-pending-payment';
export const TICKET_TARGET_KEY = 'distrax-open-ticket';
export const RECEIPT_TARGET_KEY = 'distrax-open-receipt';

/** Un paiement laissé en attente au-delà de ce délai n'est plus repris. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export const BOOKING_STATUS_LABELS = {
    held: 'Paiement en attente',
    confirmed: 'Participation confirmée',
    expired: 'Réservation expirée',
    cancelled: 'Participation annulée',
    refund_due: 'Remboursement en cours',
};

export const PAYMENT_STATUS_LABELS = {
    pending: 'Paiement en attente de confirmation',
    processing: 'Paiement en cours de vérification',
    succeeded: 'Paiement confirmé',
    failed: 'Paiement refusé',
    unknown: 'Paiement à vérifier',
};

export const REFUND_STATUS_LABELS = {
    requested: 'Remboursement demandé',
    processing: 'Remboursement en cours',
    succeeded: 'Remboursement effectué',
    failed: 'Remboursement à reprendre',
    unknown: 'Remboursement à vérifier',
};

export const TICKET_STATUS_LABELS = {
    active: 'Billet valide',
    checked_in: 'Billet déjà utilisé',
    void: 'Billet annulé',
};

export const PAYOUT_STATUS_LABELS = {
    requested: 'Retrait demandé',
    processing: 'Retrait en cours de traitement',
    succeeded: 'Retrait versé',
    failed: 'Retrait échoué',
    unknown: 'Retrait à vérifier',
};

export const DESTINATION_STATUS_LABELS = {
    pending_verification: 'En attente de vérification',
    verified: 'Destination vérifiée',
    rejected: 'Destination refusée',
};

export function payoutStatusLabel(status) {
    return PAYOUT_STATUS_LABELS[status] || status || '—';
}

export function destinationStatusLabel(status) {
    return DESTINATION_STATUS_LABELS[status] || status || '—';
}

export function formatAmount(amount, currency = 'XOF') {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';
    const formatted = value.toLocaleString('fr-FR');
    return currency === 'XOF' ? `${formatted} FCFA` : `${formatted} ${currency}`;
}

export function formatDeadline(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Une envie relève du parcours payant lorsque la plateforme encaisse le
 * participant. Les autres cas (gratuit, contribution, organisateur encaisse)
 * conservent l'inscription historique.
 */
export function isPaidJourney(desire = {}) {
    return desire.payment_policy === 'platform_required'
        && desire.price_type === 'paid'
        && desire.pay_mode === 'they_pay'
        && desire.price_amount != null
        && Number(desire.price_amount) >= 0
        && (desire.currency || 'XOF') === 'XOF';
}

/* ── Mémoire locale du paiement en cours ─────────────────────── */

function readJson(key) {
    try {
        const raw = window.sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeJson(key, value) {
    try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* stockage indisponible : la reprise sera simplement ignorée */
    }
}

function removeKey(key) {
    try {
        window.sessionStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

export function rememberPendingPayment({ paymentId, bookingId = null, desireId = null } = {}) {
    if (!paymentId) return;
    writeJson(PENDING_PAYMENT_KEY, {
        paymentId: String(paymentId),
        bookingId: bookingId ? String(bookingId) : null,
        desireId: desireId ? String(desireId) : null,
        created_at: Date.now(),
    });
}

export function readPendingPayment() {
    const pending = readJson(PENDING_PAYMENT_KEY);
    if (!pending?.paymentId) return null;
    return pending;
}

/** Efface la mémoire, sauf si un autre paiement a pris sa place entre-temps. */
export function clearPendingPayment({ paymentId = null } = {}) {
    if (paymentId) {
        const pending = readPendingPayment();
        if (pending && String(pending.paymentId) !== String(paymentId)) return;
    }
    removeKey(PENDING_PAYMENT_KEY);
}

export function rememberTicketTarget(context = {}) {
    writeJson(TICKET_TARGET_KEY, {
        bookingId: context.bookingId ? String(context.bookingId) : null,
        desireId: context.desireId ? String(context.desireId) : null,
    });
}

export function readTicketTarget() {
    return readJson(TICKET_TARGET_KEY);
}

export function clearTicketTarget() {
    removeKey(TICKET_TARGET_KEY);
}

export function rememberReceiptTarget(paymentId) {
    if (paymentId) writeJson(RECEIPT_TARGET_KEY, { paymentId: String(paymentId) });
}

export function readReceiptTarget() {
    const target = readJson(RECEIPT_TARGET_KEY);
    return target?.paymentId ? target.paymentId : null;
}

export function clearReceiptTarget() {
    removeKey(RECEIPT_TARGET_KEY);
}

/* ── Vérification différée (jamais le retour seul) ───────────── */

function wait(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Interroge l'état réel du paiement. Le retour navigateur ne fournit aucun
 * statut : tant que la banque n'a pas confirmé côté serveur, l'état reste
 * « en attente ».
 */
export async function verifyPendingPayment(pending, { attempts = 3, delayMs = 2500 } = {}) {
    if (!pending?.paymentId) return null;
    const { api } = await import('../api.js');
    let payment = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        payment = await api.getPayment(pending.paymentId);
        if (payment?.status === 'succeeded' || payment?.status === 'failed') break;
        if (attempt < attempts - 1) await wait(delayMs);
    }
    return payment;
}

/**
 * Reprise après retour CinetPay ou reconnexion.
 * @returns {Promise<null | {outcome: 'succeeded'|'failed'|'pending', payment: object, booking: object|null, pending: object}>}
 */
export async function resumePendingPayment() {
    const pending = readPendingPayment();
    if (!pending) return null;
    if (Date.now() - Number(pending.created_at || 0) > PENDING_TTL_MS) {
        clearPendingPayment({ paymentId: pending.paymentId });
        return null;
    }

    const { api } = await import('../api.js');
    const payment = await verifyPendingPayment(pending);
    if (!payment) return null;

    if (payment.status === 'succeeded') {
        clearPendingPayment({ paymentId: pending.paymentId });
        let booking = null;
        try {
            booking = await api.getBooking(payment.booking_id || pending.bookingId);
        } catch {
            booking = null;
        }
        return { outcome: 'succeeded', payment, booking, pending };
    }

    if (payment.status === 'failed') {
        clearPendingPayment({ paymentId: pending.paymentId });
        return { outcome: 'failed', payment, pending };
    }

    return { outcome: 'pending', payment, pending };
}

/** Retrouve la participation payante liée à une envie (deep link billet). */
export async function findJoinedEntry(desireId) {
    if (!desireId) return null;
    const { api } = await import('../api.js');
    const joined = await api.getJoinedDesires();
    if (!Array.isArray(joined)) return null;
    return joined.find((entry) => String(entry.id) === String(desireId)) || null;
}
