/**
 * Parcours organisateur (ORG-01 à ORG-05) : helpers d'affichage purs.
 *
 * Aucun accès réseau ici. Les libellés reprennent le vocabulaire du contrat
 * (`payment_status`, `funds_status`, `ticket_status`) pour que l'écran reste
 * cohérent avec le journal financier côté serveur.
 */

/** Cible mémorisée entre la navigation et le montage de la page. */
export const ORGANIZER_PAYMENTS_TARGET_KEY = 'distrax-organizer-payments-target';
export const SCAN_TARGET_KEY = 'distrax-scan-target';
export const WITHDRAWAL_TARGET_KEY = 'distrax-withdrawal-target';

const PAYMENT_STATUS_LABELS = {
    pending: 'Paiement en attente',
    succeeded: 'Paiement reçu',
    failed: 'Paiement échoué',
    unknown: 'Paiement à vérifier',
};

const FUNDS_STATUS_LABELS = {
    pending: 'Fonds en attente',
    available: 'Net débloqué',
    held: 'Fonds retenus',
};

const TICKET_STATUS_LABELS = {
    active: 'Billet actif',
    checked_in: 'Entrée validée',
    void: 'Billet invalidé',
};

const SCAN_ERROR_MESSAGES = {
    ALREADY_SCANNED: 'Billet déjà validé.',
    WRONG_EVENT: 'Ce billet appartient à une autre envie.',
    TICKET_VOID: 'Ce billet a été invalidé.',
    SCAN_WINDOW_CLOSED: 'Le contrôle d’entrée est fermé pour cette envie.',
    FUNDS_HELD: 'Ce billet est bloqué par un litige.',
    PAYMENT_PENDING: 'Le paiement de ce billet n’est pas encore confirmé.',
    BACKUP_CODE_UNAVAILABLE: 'Ce code de secours n’est plus valable.',
    TICKET_NOT_FOUND: 'Billet introuvable.',
    DESIRE_NOT_FOUND: 'Cette envie est introuvable ou ne vous appartient pas.',
    VALIDATION_ERROR: 'Saisie invalide : présentez le QR ou un code à 8 chiffres.',
    IDEMPOTENCY_IN_PROGRESS: 'La validation précédente est encore en cours. Réessayez dans un instant.',
};

export function paymentStatusLabel(status) {
    return PAYMENT_STATUS_LABELS[status] || status || '—';
}

export function fundsStatusLabel(status) {
    return FUNDS_STATUS_LABELS[status] || status || '—';
}

export function ticketStatusLabel(status) {
    return TICKET_STATUS_LABELS[status] || status || '—';
}

/**
 * Une envie relève du parcours organisateur (scan, portefeuille) seulement
 * lorsqu'elle est payante et encaissée par la plateforme.
 */
export function isPlatformPaidDesire(desire) {
    return desire?.payment_policy === 'platform_required' && desire?.price_type === 'paid';
}

/**
 * Distingue un code de secours (8 chiffres) d'un jeton QR.
 * @returns {{kind: 'qr_token'|'backup_code'|null, value: string}}
 */
export function normalizeScanInput(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return { kind: null, value: '' };
    if (/^\d{8}$/.test(raw)) return { kind: 'backup_code', value: raw };
    return { kind: 'qr_token', value: raw };
}

/** Message compréhensible pour chaque refus de scan (ORG-04). */
export function scanErrorMessage(error) {
    const code = error?.code;
    if (code && SCAN_ERROR_MESSAGES[code]) return SCAN_ERROR_MESSAGES[code];
    return error?.message || 'Impossible de valider ce billet. Réessayez.';
}

function storage() {
    try {
        return typeof window !== 'undefined' ? window.sessionStorage : null;
    } catch {
        return null;
    }
}

export function rememberOrganizerTarget(key, value) {
    const store = storage();
    if (!store) return;
    try {
        if (value) store.setItem(key, String(value));
        else store.removeItem(key);
    } catch {
        /* stockage indisponible */
    }
}

export function readOrganizerTarget(key) {
    const store = storage();
    if (!store) return null;
    try {
        return store.getItem(key) || null;
    } catch {
        return null;
    }
}

export function clearOrganizerTarget(key) {
    rememberOrganizerTarget(key, null);
}
