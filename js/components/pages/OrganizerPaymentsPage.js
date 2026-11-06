import { escapeHtml } from '../../utils/escapeHtml.js';
import '../ui/paymentScreens.css';
import { formatAmount } from '../../utils/paymentFlow.js';
import {
    ORGANIZER_PAYMENTS_TARGET_KEY,
    clearOrganizerTarget,
    paymentStatusLabel,
    readOrganizerTarget,
} from '../../utils/organizerView.js';

const PAGE_SIZE = 30;

export class OrganizerPaymentsPage extends HTMLElement {
    constructor() {
        super();
        this._context = {};
        this._items = [];
        this._nextCursor = null;
        this._paidCount = 0;
        this._loadingMore = false;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .organizer-payments-page {
                    height: 100svh; overflow-y: auto; background: var(--bg-main, #f5f6fa);
                }
                .org-header {
                    position: sticky; top: 0; z-index: 5;
                    background: var(--glass-bg, var(--bg-main));
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--border-light);
                }
                .org-header .flow-muted { text-align: center; overflow-wrap: anywhere; }
                .org-count { margin: 0; }
                .org-payment-list { list-style: none; margin: 0; padding: 4px 16px; }
                .org-payment-list .flow-person > div { min-width: 0; }
                .org-payment-list .flow-person > strong { flex-shrink: 0; }
                .org-load-more {
                    align-self: center; border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 100px; padding: 10px 20px; background: var(--bg-card, #fff);
                    color: var(--text-main, #111827); font-weight: 600; font-size: 13px; cursor: pointer;
                }
                .org-load-more:disabled { opacity: 0.55; cursor: default; }
                .org-state {
                    display: flex; flex-direction: column; align-items: center; gap: 10px;
                    padding: 44px 20px; text-align: center; color: var(--text-muted, #6b7280);
                }
                .org-state .material-icons-round { font-size: 44px; opacity: 0.55; }
                .org-retry-btn {
                    border: none; border-radius: 100px; padding: 11px 22px;
                    background: var(--primary, #0ea5e9); color: white; font-weight: 600;
                    font-size: 13px; cursor: pointer;
                }
            </style>

            <section class="page-section organizer-payments-page" id="organizerPaymentsPage" style="display: none;">
                <header class="org-header flow-header">
                    <button class="round-icon-btn back-from-organizer-payments" type="button" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div>
                        <h1>Paiements</h1>
                        <p class="flow-muted" id="organizerPaymentsSubtitle" hidden></p>
                    </div>
                    <span></span>
                </header>
                <div class="flow-body" id="organizerPaymentsBody"></div>
            </section>
        `;

        this.querySelector('.back-from-organizer-payments')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show(context = {}) {
        const stored = readOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY);
        clearOrganizerTarget(ORGANIZER_PAYMENTS_TARGET_KEY);
        this._context = { desireId: context.desireId || stored || null };
        this._items = [];
        this._nextCursor = null;
        this._paidCount = 0;
        this._loadingMore = false;
        this._setSubtitle('');
        const page = this.querySelector('#organizerPaymentsPage');
        if (page) page.style.display = 'block';
        this._load();
    }

    hide() {
        const page = this.querySelector('#organizerPaymentsPage');
        if (page) page.style.display = 'none';
    }

    _setSubtitle(title) {
        const subtitle = this.querySelector('#organizerPaymentsSubtitle');
        subtitle.textContent = title;
        subtitle.hidden = !title;
    }

    _renderState(icon, message, { retry = false } = {}) {
        const body = this.querySelector('#organizerPaymentsBody');
        if (!body) return;
        body.innerHTML = `
            <div class="org-state">
                <i class="material-icons-round" aria-hidden="true">${escapeHtml(icon)}</i>
                <p role="status">${escapeHtml(message)}</p>
                ${retry ? '<button class="org-retry-btn" type="button" id="organizerPaymentsRetry">Réessayer</button>' : ''}
            </div>
        `;
        if (retry) {
            this.querySelector('#organizerPaymentsRetry')?.addEventListener('click', () => this._load());
        }
    }

    async _load() {
        const context = this._context;
        if (!context.desireId) {
            this._renderState('event_busy', 'Aucune envie sélectionnée.');
            return;
        }
        this._renderState('hourglass_empty', 'Chargement des paiements…');
        try {
            const { api } = await import('../../api.js');
            const [desire, page] = await Promise.all([
                api.getDesire(context.desireId).catch(() => null),
                api.getOrganizerPayments(context.desireId, { limit: PAGE_SIZE }),
            ]);
            if (context !== this._context) return;
            this._setSubtitle(desire?.title || '');
            this._paidCount = page?.paid_count ?? 0;
            this._items = Array.isArray(page?.items) ? page.items : [];
            this._nextCursor = page?.next_cursor || null;
            this._render();
        } catch (error) {
            if (context !== this._context) return;
            const message = error?.status === 404
                ? 'Cette envie est introuvable ou ne vous appartient pas.'
                : (error?.message || 'Impossible de charger les paiements.');
            this._renderState('event_busy', message, { retry: error?.status !== 404 });
        }
    }

    async _loadMore() {
        if (this._loadingMore || !this._nextCursor) return;
        const context = this._context;
        const cursor = this._nextCursor;
        this._loadingMore = true;
        const button = this.querySelector('#organizerPaymentsMore');
        if (button) {
            button.disabled = true;
            button.textContent = 'Chargement…';
        }
        try {
            const { api } = await import('../../api.js');
            const page = await api.getOrganizerPayments(context.desireId, { cursor, limit: PAGE_SIZE });
            if (context !== this._context) return;
            this._paidCount = page?.paid_count ?? this._paidCount;
            this._items = this._items.concat(Array.isArray(page?.items) ? page.items : []);
            this._nextCursor = page?.next_cursor || null;
            this._render();
        } catch (error) {
            if (context !== this._context) return;
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: error?.message || 'Impossible de charger la suite.', type: 'error' },
            }));
            if (button) {
                button.disabled = false;
                button.textContent = 'Charger plus';
            }
        } finally {
            if (context === this._context) this._loadingMore = false;
        }
    }

    _paymentItem(item) {
        const currency = item?.currency || 'XOF';
        const status = item?.funds_status === 'held' ? 'Paiement en cours d’examen'
            : paymentStatusLabel(item?.payment_status);
        return `
            <li class="flow-person flow-row">
                <div><strong>${escapeHtml(item?.participant_name || 'Participant')}</strong><p class="flow-muted">${escapeHtml(status)}</p></div>
                <strong>${escapeHtml(formatAmount(item?.gross, currency))}</strong>
            </li>
        `;
    }

    _render() {
        const body = this.querySelector('#organizerPaymentsBody');
        if (!body) return;
        if (!this._items.length && !this._nextCursor) {
            this._renderState('receipt_long', 'Aucun paiement pour le moment.');
            return;
        }
        const countLabel = this._paidCount > 1 ? 'paiements reçus' : 'paiement reçu';
        body.innerHTML = `
            <h2 class="flow-title org-count">${escapeHtml(String(this._paidCount))} ${countLabel}</h2>
            <ul class="flow-card org-payment-list" role="list">
                ${this._items.map((item) => this._paymentItem(item)).join('')}
            </ul>
            ${this._nextCursor ? '<button class="org-load-more" type="button" id="organizerPaymentsMore">Charger plus</button>' : ''}
        `;

        this.querySelector('#organizerPaymentsMore')?.addEventListener('click', () => this._loadMore());
    }
}

customElements.define('app-organizer-payments-page', OrganizerPaymentsPage);
