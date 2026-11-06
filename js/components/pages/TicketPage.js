/**
 * TicketPage — billet personnel et QR sécurisé (PAR-03/PAR-04).
 *
 * Le jeton QR n'est fourni par l'API que pour un billet actif et seulement au
 * propriétaire de la réservation. La page ne fabrique donc aucun QR à partir
 * d'un identifiant : elle affiche le jeton opaque reçu.
 */
import QRCode from 'qrcode';
import '../ui/paymentScreens.css';
import '../ui/FinancialRequest.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import {
    TICKET_STATUS_LABELS,
    clearTicketTarget,
    findJoinedEntry,
    formatDeadline,
    formatAmount,
    REFUND_STATUS_LABELS,
    rememberReceiptTarget,
    readTicketTarget,
} from '../../utils/paymentFlow.js';

function formatEventDate(iso, timezone) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const options = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    };
    try {
        return date.toLocaleString('fr-FR', timezone ? { ...options, timeZone: timezone } : options);
    } catch {
        return date.toLocaleString('fr-FR', options);
    }
}

export class TicketPage extends HTMLElement {
    constructor() {
        super();
        this._context = {};
        this._ticket = null;
        this._desireTitle = '';
        this._loading = false;
        this._generation = 0;
        this._cancelling = false;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .ticket-page { height: 100svh; overflow-y: auto; background: var(--bg-main, #f5f6fa); }
                .ticket-header {
                    display: flex; align-items: center; gap: 12px;
                    padding: 18px 20px; position: sticky; top: 0; z-index: 5;
                    background: var(--glass-bg, rgba(255,255,255,0.9));
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--border-light, #e5e7eb);
                }
                .ticket-header h1 { font-size: 17px; font-weight: 700; color: var(--text-main, #111827); margin: 0; }
                .ticket-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
                .ticket-card {
                    background: var(--bg-card, #fff); border-radius: 20px; padding: 22px;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                    border: 1px solid var(--border-light, #e5e7eb);
                    display: flex; flex-direction: column; gap: 16px; align-items: center;
                    text-align: center;
                }
                .ticket-eyebrow {
                    font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em;
                    color: var(--text-muted, #6b7280); font-weight: 700;
                }
                .ticket-title { font-size: 18px; font-weight: 700; color: var(--text-main, #111827); margin: 0; }
                .ticket-date { font-size: 13px; color: var(--text-muted, #6b7280); margin: 0; }
                .ticket-status {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 700;
                }
                .ticket-status.active { background: #d1fae5; color: #047857; }
                .ticket-status.checked_in { background: #e0e7ff; color: #4338ca; }
                .ticket-status.void { background: #fee2e2; color: #b91c1c; }
                .ticket-qr {
                    width: min(240px, 100%); aspect-ratio: 1; box-sizing: border-box; padding: 12px; border-radius: 16px;
                    background: white; border: 1px dashed #cbd5e1;
                    display: flex; align-items: center; justify-content: center;
                }
                .ticket-qr img { width: 100%; height: 100%; display: block; }
                .ticket-hint { font-size: 12px; color: var(--text-muted, #6b7280); margin: 0; max-width: 280px; }
                .ticket-note {
                    background: var(--bg-card, #f9fafb); border-radius: 14px; padding: 14px 16px;
                    font-size: 13px; color: var(--text-main, #111827); line-height: 1.5;
                    width: 100%; box-sizing: border-box; text-align: left;
                }
                .ticket-backup {
                    width: 100%; box-sizing: border-box; border-top: 1px dashed #cbd5e1;
                    padding-top: 16px; display: flex; flex-direction: column; gap: 10px;
                    text-align: center;
                }
                .ticket-backup-btn {
                    border: 1px solid var(--border-light, #e5e7eb); border-radius: 100px;
                    padding: 11px 18px; background: var(--bg-main, #f9fafb);
                    color: var(--text-main, #111827); font-weight: 600; font-size: 13px; cursor: pointer;
                }
                .ticket-backup-btn:disabled { opacity: 0.55; cursor: default; }
                .ticket-backup-code {
                    font-size: 28px; font-weight: 800; letter-spacing: 0.28em;
                    color: var(--text-main, #111827); margin: 0;
                }
                .ticket-backup-meta { font-size: 12px; color: var(--text-muted, #6b7280); margin: 0; }
                .ticket-state {
                    display: flex; flex-direction: column; align-items: center; gap: 10px;
                    padding: 40px 20px; text-align: center; color: var(--text-muted, #6b7280);
                }
                .ticket-state .material-icons-round { font-size: 44px; opacity: 0.55; }
                .ticket-retry-btn {
                    border: none; border-radius: 100px; padding: 11px 22px;
                    background: var(--primary, #6366f1); color: white; font-weight: 600;
                    font-size: 13px; cursor: pointer;
                }
                .ticket-spinner {
                    width: 34px; height: 34px; border-radius: 50%;
                    border: 3px solid rgba(99,102,241,0.2); border-top-color: var(--primary, #6366f1);
                    animation: ticket-spin 0.9s linear infinite;
                }
                @keyframes ticket-spin { to { transform: rotate(360deg); } }
            </style>

            <section class="page-section ticket-page" id="ticketPage" style="display: none;">
                <header class="ticket-header flow-header">
                    <button class="round-icon-btn back-from-ticket" type="button" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <h1>Mon billet</h1>
                    <span></span>
                </header>
                <div class="ticket-body" id="ticketBody">
                    <div class="ticket-state" id="ticketState">
                        <div class="ticket-spinner"></div>
                        <p>Chargement de votre billet…</p>
                    </div>
                </div>
            </section>
        `;

        this.querySelector('.back-from-ticket')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show(context = {}) {
        this._ticket = null;
        this._booking = null;
        this._refund = null;
        this._desire = null;
        this._desireTitle = '';
        this._cancelKey = null;
        const stored = readTicketTarget() || {};
        clearTicketTarget();
        this._context = {
            bookingId: context.bookingId || stored.bookingId || null,
            desireId: context.desireId || stored.desireId || null,
        };
        const page = this.querySelector('#ticketPage');
        if (page) page.style.display = 'block';
        this._load();
    }

    hide() {
        this._generation += 1;
        const page = this.querySelector('#ticketPage');
        if (page) page.style.display = 'none';
    }

    _renderState(icon, message, { retry = false } = {}) {
        const body = this.querySelector('#ticketBody');
        if (!body) return;
        body.innerHTML = `
            <div class="ticket-state">
                <i class="material-icons-round">${escapeHtml(icon)}</i>
                <p>${escapeHtml(message)}</p>
                ${retry ? '<button class="ticket-retry-btn" type="button" id="ticketRetryBtn">Vérifier à nouveau</button>' : ''}
            </div>
        `;
        if (retry) {
            this.querySelector('#ticketRetryBtn')?.addEventListener('click', () => this._load());
        }
    }

    async _resolveBookingId(api) {
        if (this._context.bookingId) return this._context.bookingId;
        if (!this._context.desireId) return null;
        const entry = await findJoinedEntry(this._context.desireId);
        if (entry?.booking_id) {
            this._context.bookingId = entry.booking_id;
            return entry.booking_id;
        }
        return null;
    }

    async _load() {
        const generation = ++this._generation;
        this._loading = true;
        this._renderState('hourglass_empty', 'Chargement de votre billet…');
        try {
            const { api } = await import('../../api.js');
            const bookingId = await this._resolveBookingId(api);
            if (!bookingId) {
                this._renderState(
                    'confirmation_number',
                    "Aucun billet n'est encore disponible. Votre billet apparaît dès que le paiement est confirmé.",
                    { retry: true },
                );
                return;
            }

            const [ticket, booking] = await Promise.all([api.getTicket(bookingId), api.getBooking(bookingId)]);
            if (generation !== this._generation) return;
            this._ticket = ticket;
            this._booking = booking;
            const [desire, refund] = await Promise.all([
                api.getDesire(ticket.desire_id).catch(() => null),
                booking.refund_id ? api.getRefund(booking.refund_id).catch(() => null) : null,
            ]);
            if (generation !== this._generation) return;
            this._desire = desire;
            this._desireTitle = desire?.title || '';
            this._refund = refund;
            this._renderTicket();
        } catch (error) {
            if (generation !== this._generation) return;
            const message = error?.code === 'TICKET_NOT_FOUND' || error?.status === 404
                ? "Votre billet apparaîtra dès la confirmation du paiement."
                : (error?.message || 'Impossible de charger votre billet.');
            this._renderState('confirmation_number', message, { retry: true });
        } finally {
            this._loading = false;
        }
    }

    _renderTicket() {
        const body = this.querySelector('#ticketBody');
        const ticket = this._ticket;
        if (!body || !ticket) return;

        const status = ticket.status === 'checked_in' || ticket.status === 'void'
            ? ticket.status
            : 'active';
        const statusLabel = TICKET_STATUS_LABELS[status] || TICKET_STATUS_LABELS.active;
        const dateLabel = formatEventDate(ticket.event_start, ticket.timezone);
        const booking = this._booking || {};
        const canCancel = status === 'active' && booking.allowed_actions?.includes('cancel');
        const notice = this._refund ? REFUND_STATUS_LABELS[this._refund.status]
            : booking.refund_id ? 'Participation annulée. Le remboursement est suivi par notre équipe.'
            : status === 'checked_in' ? 'Votre présence a été validée. L’annulation n’est plus disponible.'
            : booking.cancellation_deadline && (canCancel || new Date(booking.cancellation_deadline) < new Date()) ? `${canCancel ? 'Annulation possible jusqu’au' : 'Annulation fermée depuis le'} ${formatDeadline(booking.cancellation_deadline)}.`
            : 'La disponibilité de l’annulation est vérifiée par Distrax.';

        body.innerHTML = `
            <div class="ticket-card">
                <div class="flow-row"><span class="flow-pill">${escapeHtml(status === 'active' ? 'Place confirmée' : statusLabel)}</span><span class="flow-muted">1 personne</span></div>
                <h2 class="ticket-title">${escapeHtml(this._desireTitle || "Billet d'entrée")}</h2>
                <p class="ticket-date">${escapeHtml(this._desire?.address || this._desire?.commune || this._desire?.location_name || '')}</p>
                <p class="ticket-date">${escapeHtml(dateLabel)}</p>
                <div class="ticket-qr" id="ticketQr">
                    ${status === 'active' && ticket.qr_token
                        ? '<div class="ticket-spinner"></div>'
                        : `<i class="material-icons-round" style="font-size:44px;color:#cbd5e1;">${status === 'void' ? 'qr_code_2' : 'task_alt'}</i>`}
                </div>
                <p class="ticket-hint">
                    ${status === 'active'
                        ? 'Présentez ce QR code à l’entrée. Il est personnel et ne peut être utilisé qu’une fois.'
                        : status === 'checked_in'
                            ? 'Ce billet a déjà été scanné à l’entrée.'
                            : 'Ce billet a été invalidé. Il ne permet plus l’accès à l’activité.'}
                </p>
                <div class="flow-line"></div>
                <div class="flow-row"><span class="flow-muted">Montant payé</span><strong>${escapeHtml(formatAmount(booking.total_amount, booking.currency))}</strong></div>
                ${booking.payment_id ? '<button class="flow-link" id="ticketReceiptBtn" type="button">Voir mon reçu de paiement</button>' : ''}
            </div>
            <div class="flow-notice" role="status">${escapeHtml(notice)}</div>
            ${canCancel ? '<button class="flow-btn secondary" id="ticketCancelBtn" type="button">Annuler ma réservation</button>' : ''}
            ${status === 'active' ? `
                    <details class="flow-details"><summary>Mon QR code ne fonctionne pas</summary><div class="ticket-backup">
                        <button class="ticket-backup-btn" type="button" id="ticketBackupBtn">
                            Générer un code de secours
                        </button>
                        <div id="ticketBackupResult"></div>
                    </div></details>
                ` : ''}
            <p id="ticketActionStatus" class="flow-muted" role="status"></p>
        `;

        this.querySelector('#ticketBackupBtn')?.addEventListener('click', () => {
            this._requestBackupCode();
        });
        this.querySelector('#ticketCancelBtn')?.addEventListener('click', () => this._cancelBooking());
        this.querySelector('#ticketReceiptBtn')?.addEventListener('click', () => {
            rememberReceiptTarget(booking.payment_id);
            document.dispatchEvent(new CustomEvent('open-receipt', { bubbles: true, composed: true, detail: { paymentId: booking.payment_id } }));
        });

        if (ticket.booking_id) {
            const request = document.createElement('financial-request');
            request.setAttribute('booking-id', ticket.booking_id);
            body.appendChild(request);
        }

        if (status === 'active' && ticket.qr_token) {
            const qrContainer = this.querySelector('#ticketQr');
            QRCode.toDataURL(ticket.qr_token, {
                width: 480,
                margin: 1,
                errorCorrectionLevel: 'M',
                color: { dark: '#111827', light: '#ffffff' },
            }).then((dataUrl) => {
                const container = this.querySelector('#ticketQr');
                if (!container || container !== qrContainer || this._ticket !== ticket || ticket.status !== 'active') return;
                container.innerHTML = `<img alt="QR code du billet" src="${dataUrl}">`;
            }).catch(() => {
                const container = this.querySelector('#ticketQr');
                if (container && container === qrContainer) {
                    container.innerHTML = '<p class="ticket-hint">QR momentanément indisponible. Réessayez plus tard.</p>';
                }
            });
        }
    }
    async _cancelBooking() {
        if (this._cancelling || !this._booking?.allowed_actions?.includes('cancel')) return;
        this._cancelling = true;
        const booking = this._booking;
        const button = this.querySelector('#ticketCancelBtn');
        if (button) button.disabled = true;
        try {
            const { showConfirm } = await import('../../utils/confirm.js');
            if (!await showConfirm({ title: 'Annuler ma réservation ?', message: 'Votre billet sera invalidé. Notre équipe traitera le remboursement et vous pourrez en suivre l’état.', confirmLabel: 'Annuler la réservation', cancelLabel: 'Garder ma place', type: 'danger' })) return;
            if (this._booking !== booking) return;
            const { api } = await import('../../api.js');
            this._cancelKey ||= crypto.randomUUID();
            const refund = await api.cancelBooking(booking.id, { idempotencyKey: this._cancelKey });
            if (this._booking !== booking) return;
            this._refund = refund;
            this._booking = { ...booking, status: 'cancelled', refund_id: refund.id, allowed_actions: [] };
            this._ticket = { ...this._ticket, status: 'void', qr_token: null };
            this._renderTicket();
        } catch (error) {
            const status = this.querySelector('#ticketActionStatus');
            if (status) status.textContent = error.message || 'Annulation non confirmée. Vous pouvez réessayer.';
        } finally {
            this._cancelling = false;
            if (button) button.disabled = false;
        }
    }
    async _requestBackupCode() {
        const button = this.querySelector('#ticketBackupBtn');
        const result = this.querySelector('#ticketBackupResult');
        const bookingId = this._context.bookingId || this._ticket?.booking_id;
        if (!button || !result || !bookingId) return;

        button.disabled = true;
        button.textContent = 'Génération…';
        result.innerHTML = '';
        try {
            const { api } = await import('../../api.js');
            const backup = await api.requestBackupCode(bookingId);
            const code = String(backup?.code || '');
            const grouped = code.replace(/(\d{4})(\d{4})/, '$1 $2');
            const expiry = formatDeadline(backup?.expires_at);
            result.innerHTML = `
                <p class="ticket-backup-code">${escapeHtml(grouped)}</p>
                <p class="ticket-backup-meta">
                    Code valable une seule fois${expiry ? ` jusqu’au ${escapeHtml(expiry)}` : ''}.
                    Communiquez-le à l’organisateur si le QR est illisible.
                </p>
            `;
            button.textContent = 'Générer un nouveau code';
        } catch (error) {
            result.innerHTML = `
                <p class="ticket-backup-meta">${escapeHtml(
                    error?.message || 'Impossible de générer un code de secours pour le moment.',
                )}</p>
            `;
            button.textContent = 'Générer un code de secours';
        } finally {
            button.disabled = false;
        }
    }
}

customElements.define('app-ticket-page', TicketPage);
