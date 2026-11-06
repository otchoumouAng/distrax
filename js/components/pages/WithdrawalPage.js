/**
 * WithdrawalPage — demande de retrait et historique (REV-05).
 *
 * Le montant est prérempli avec le solde disponible et la destination vérifiée
 * est réutilisée. Les frais et le montant reçu viennent du devis serveur : le
 * client ne les calcule jamais. La demande réserve les fonds, puis l'exécution
 * reste manuelle côté équipe financière — aucun versement n'est déclenché ici.
 */
import { escapeHtml } from '../../utils/escapeHtml.js';
import '../ui/paymentScreens.css';
import { WITHDRAWAL_TARGET_KEY, readOrganizerTarget, clearOrganizerTarget } from '../../utils/organizerView.js';
import { destinationStatusLabel, formatAmount, payoutStatusLabel } from '../../utils/paymentFlow.js';

const PAGE_SIZE = 20;

const OPERATORS = [
    { value: 'orange_money', label: 'Orange Money' },
    { value: 'mtn_money', label: 'MTN Mobile Money' },
    { value: 'moov_money', label: 'Moov Money' },
    { value: 'wave', label: 'Wave' },
];

const PAYOUT_ERROR_MESSAGES = {
    INSUFFICIENT_BALANCE: 'Solde disponible insuffisant : réduisez le montant du retrait.',
    DESTINATION_UNVERIFIED: 'Cette destination attend encore la vérification de l’équipe financière.',
    DESTINATION_NOT_FOUND: 'Cette destination est introuvable ou ne vous appartient pas.',
    PAYOUT_QUOTE_EXPIRED: 'Ce devis a expiré. Vérifiez à nouveau le montant.',
    PAYOUT_QUOTE_NOT_FOUND: 'Ce devis est introuvable. Vérifiez à nouveau le montant.',
    VERSION_CONFLICT: 'Le solde a changé entre-temps. Vérifiez à nouveau le montant.',
    IDEMPOTENCY_IN_PROGRESS: 'La demande précédente est encore en cours de traitement.',
    IDEMPOTENCY_CONFLICT: 'Cette demande a déjà été utilisée pour un autre retrait.',
    PAYOUT_LEDGER_MISMATCH: 'Le retrait doit être vérifié par l’équipe financière.',
    VALIDATION_ERROR: 'Vérifiez le montant et la destination sélectionnée.',
};

function payoutErrorMessage(error) {
    if (error?.code && PAYOUT_ERROR_MESSAGES[error.code]) return PAYOUT_ERROR_MESSAGES[error.code];
    return error?.message || 'Impossible d’effectuer le retrait.';
}

function operatorLabel(value) {
    const match = OPERATORS.find((operator) => operator.value === value);
    return match ? match.label : value;
}

function newIdempotencyKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notify(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
}

export class WithdrawalPage extends HTMLElement {
    constructor() {
        super();
        this._wallet = null;
        this._destinations = [];
        this._payouts = [];
        this._nextCursor = null;
        this._quote = null;
        this._quoteKey = null;
        this._payoutKey = null;
        this._loading = false;
        this._busy = false;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .withdrawal-page { height: 100svh; overflow-y: auto; background: var(--bg-main, #f5f6fa); }
                .wd-header {
                    display: flex; align-items: center; gap: 12px;
                    padding: 18px 20px; position: sticky; top: 0; z-index: 5;
                    background: var(--glass-bg, rgba(255,255,255,0.9));
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--border-light, #e5e7eb);
                }
                .wd-header h1 { font-size: 17px; font-weight: 700; color: var(--text-main, #111827); margin: 0; }
                .wd-body { padding: 16px 16px 28px; display: flex; flex-direction: column; gap: 16px; }
                .wd-hero {
                    background: linear-gradient(135deg, #0ea5e9, #2563eb);
                    color: white; border-radius: 20px; padding: 22px;
                    display: flex; flex-direction: column; gap: 6px;
                }
                .wd-hero span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85; }
                .wd-hero strong { font-size: 30px; font-weight: 800; line-height: 1.1; }
                .wd-hero small { font-size: 11px; opacity: 0.8; }
                .wd-card {
                    background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
                }
                .wd-card h2 {
                    font-size: 13px; font-weight: 700; color: var(--text-muted, #6b7280);
                    text-transform: uppercase; letter-spacing: 0.06em; margin: 0;
                }
                .wd-field { display: flex; flex-direction: column; gap: 6px; }
                .wd-field label { font-size: 12px; font-weight: 700; color: var(--text-muted, #4b5563); }
                .wd-field input, .wd-field select {
                    width: 100%; box-sizing: border-box; border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 12px; padding: 12px 14px; font-size: 15px;
                    background: var(--bg-main, #f9fafb); color: var(--text-main, #111827);
                }
                .wd-field small { font-size: 11px; color: var(--text-muted, #6b7280); }
                .wd-primary {
                    border: none; border-radius: 100px; padding: 13px 22px;
                    background: var(--primary, #0ea5e9); color: white; font-weight: 700;
                    font-size: 14px; cursor: pointer;
                }
                .wd-primary:disabled { opacity: 0.55; cursor: default; }
                .wd-ghost {
                    border: 1px solid var(--border-light, #e5e7eb); border-radius: 100px;
                    padding: 11px 20px; background: var(--bg-card, #fff);
                    color: var(--text-main, #111827); font-weight: 600; font-size: 13px; cursor: pointer;
                }
                .wd-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
                .wd-row span { color: var(--text-muted, #6b7280); }
                .wd-row strong { color: var(--text-main, #111827); text-align: right; }
                .wd-row.total { padding-top: 10px; border-top: 1px dashed var(--border-light, #e5e7eb); }
                .wd-row.total strong { font-size: 17px; }
                .wd-note { font-size: 12px; color: var(--text-muted, #6b7280); margin: 0; line-height: 1.5; }
                .wd-destinations, .wd-history { display: flex; flex-direction: column; gap: 10px; }
                .wd-item {
                    background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
                }
                .wd-item-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
                .wd-item-top strong { font-size: 15px; color: var(--text-main, #111827); }
                .wd-item-top span { font-size: 12px; color: var(--text-muted, #6b7280); }
                .wd-badges { display: flex; flex-wrap: wrap; gap: 6px; }
                .wd-badge {
                    font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px;
                    background: var(--bg-main, #f3f4f6); color: var(--text-muted, #4b5563);
                }
                .wd-badge.verified, .wd-badge.succeeded { background: #d1fae5; color: #047857; }
                .wd-badge.pending_verification, .wd-badge.requested, .wd-badge.unknown {
                    background: #fef3c7; color: #b45309;
                }
                .wd-badge.processing { background: #dbeafe; color: #1d4ed8; }
                .wd-badge.rejected, .wd-badge.failed { background: #fee2e2; color: #b91c1c; }
                .wd-more {
                    align-self: center; border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 100px; padding: 10px 20px; background: var(--bg-card, #fff);
                    color: var(--text-main, #111827); font-weight: 600; font-size: 13px; cursor: pointer;
                }
                .wd-more:disabled { opacity: 0.55; cursor: default; }
                .wd-state {
                    display: flex; flex-direction: column; align-items: center; gap: 10px;
                    padding: 36px 20px; text-align: center; color: var(--text-muted, #6b7280);
                }
                .wd-state .material-icons-round { font-size: 40px; opacity: 0.55; }
                .wd-spinner {
                    width: 34px; height: 34px; border-radius: 50%;
                    border: 3px solid rgba(14,165,233,0.2); border-top-color: var(--primary, #0ea5e9);
                    animation: wd-spin 0.9s linear infinite;
                }
                @keyframes wd-spin { to { transform: rotate(360deg); } }
            </style>

            <section class="page-section withdrawal-page" id="withdrawalPage" style="display: none;">
                <header class="wd-header">
                    <button class="round-icon-btn back-from-withdrawal" type="button" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <h1>Retirer mon argent</h1><span></span>
                </header>
                <div class="wd-body" id="withdrawalBody">
                    <div class="wd-state">
                        <div class="wd-spinner"></div>
                        <p>Chargement du retrait…</p>
                    </div>
                </div>
            </section>
        `;

        this.querySelector('.back-from-withdrawal')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show(context = {}) {
        this._desireId = context.desireId || readOrganizerTarget(WITHDRAWAL_TARGET_KEY) || null;
        clearOrganizerTarget(WITHDRAWAL_TARGET_KEY);
        const page = this.querySelector('#withdrawalPage');
        if (page) page.style.display = 'block';
        this._quote = null;
        this._quoteKey = null;
        this._payoutKey = null;
        this._nextCursor = null;
        this._load();
    }

    hide() {
        const page = this.querySelector('#withdrawalPage');
        if (page) page.style.display = 'none';
    }

    _renderState(icon, message, { retry = false } = {}) {
        const body = this.querySelector('#withdrawalBody');
        if (!body) return;
        body.innerHTML = `
            <div class="wd-state">
                <i class="material-icons-round">${escapeHtml(icon)}</i>
                <p>${escapeHtml(message)}</p>
                ${retry ? '<button class="wd-primary" type="button" id="withdrawalRetry">Réessayer</button>' : ''}
            </div>
        `;
        if (retry) {
            this.querySelector('#withdrawalRetry')?.addEventListener('click', () => this._load());
        }
    }

    async _load() {
        if (this._loading) return;
        this._loading = true;
        this._renderState('hourglass_empty', 'Chargement du retrait…');
        try {
            const { api } = await import('../../api.js');
            const [wallet, destinations, payouts] = await Promise.all([
                api.getOrganizerWallet({ desireId: this._desireId }),
                api.getPayoutDestinations({ limit: PAGE_SIZE }),
                api.getPayouts({ limit: PAGE_SIZE }),
            ]);
            this._wallet = wallet;
            this._destinations = Array.isArray(destinations?.items) ? destinations.items : [];
            this._payouts = Array.isArray(payouts?.items) ? payouts.items : [];
            this._nextCursor = payouts?.next_cursor || null;
            this._render();
        } catch (error) {
            const message = error?.status === 403
                ? 'Les retraits sont réservés aux organisateurs.'
                : payoutErrorMessage(error);
            this._renderState('account_balance_wallet', message, { retry: error?.status !== 403 });
        } finally {
            this._loading = false;
        }
    }

    async _loadMorePayouts() {
        if (this._loading || !this._nextCursor) return;
        const button = this.querySelector('#withdrawalMore');
        if (button) {
            button.disabled = true;
            button.textContent = 'Chargement…';
        }
        this._loading = true;
        try {
            const { api } = await import('../../api.js');
            const page = await api.getPayouts({ cursor: this._nextCursor, limit: PAGE_SIZE });
            this._payouts = this._payouts.concat(Array.isArray(page?.items) ? page.items : []);
            this._nextCursor = page?.next_cursor || null;
            this._render();
        } catch (error) {
            notify(payoutErrorMessage(error), 'error');
        } finally {
            this._loading = false;
        }
    }

    _verifiedDestinations() {
        return this._destinations.filter((destination) => destination.status === 'verified');
    }

    _destinationLabel(destinationId) {
        const destination = this._destinations.find(
            (item) => String(item.id) === String(destinationId),
        );
        if (!destination) return 'Destination de retrait';
        return `${operatorLabel(destination.operator)} · ${destination.masked_account}`;
    }

    _hero() {
        const currency = this._wallet?.currency || 'XOF';
        return `
            <div class="wd-hero">
                <span>${this._desireId ? 'Disponible pour cette envie' : 'Solde disponible'}</span>
                <strong>${escapeHtml(formatAmount(this._wallet?.available, currency))}</strong>
                <small>${escapeHtml(currency)} · ce montant peut être retiré</small>
            </div>
        `;
    }

    _quoteCard() {
        const quote = this._quote;
        const currency = quote.currency || 'XOF';
        const expires = quote.expires_at ? new Date(quote.expires_at) : null;
        const expiresLabel = expires && !Number.isNaN(expires.getTime())
            ? expires.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : '—';
        const adjustment = Number(quote.commission_adjustment || 0);
        return `
            <div class="wd-card">
                <h2>Confirmer le retrait</h2>
                <div class="wd-row">
                    <span>Destination</span>
                    <strong>${escapeHtml(this._destinationLabel(quote.destination_id))}</strong>
                </div>
                <div class="wd-row">
                    <span>Montant demandé</span>
                    <strong>${escapeHtml(formatAmount(quote.selected_balance, currency))}</strong>
                </div>
                <div class="wd-row">
                    <span>Frais de retrait</span>
                    <strong>${escapeHtml(formatAmount(quote.transfer_fee, currency))}</strong>
                </div>
                ${adjustment !== 0 ? `
                    <div class="wd-row">
                        <span>Réglage commission</span>
                        <strong>${escapeHtml(formatAmount(adjustment, currency))}</strong>
                    </div>
                ` : ''}
                <div class="wd-row total">
                    <span>Montant reçu</span>
                    <strong>${escapeHtml(formatAmount(quote.recipient_amount, currency))}</strong>
                </div>
                <p class="wd-note">
                    Devis valable jusqu’à ${escapeHtml(expiresLabel)}. En confirmant, le montant est
                    réservé sur votre solde ; le versement est ensuite exécuté manuellement par
                    l’équipe financière.
                </p>
                <button class="wd-primary" type="button" id="withdrawalConfirm">Confirmer le retrait</button>
                <button class="wd-ghost" type="button" id="withdrawalCancel">Modifier</button>
            </div>
        `;
    }

    _requestCard() {
        const currency = this._wallet?.currency || 'XOF';
        const available = Number(this._wallet?.available || 0);
        const destinations = this._verifiedDestinations();
        if (available <= 0) {
            return `
                <div class="wd-card">
                    <h2>Demander un retrait</h2>
                    <p class="wd-note">Aucun solde disponible pour le moment. Les fonds apparaissent ici une fois les ventes débloquées.</p>
                </div>
            `;
        }
        if (!destinations.length) {
            return `
                <div class="wd-card">
                    <h2>Demander un retrait</h2>
                    <p class="wd-note">
                        Aucune destination vérifiée. Enregistrez un numéro de retrait : il sera
                        contrôlé par l’équipe financière avant le premier versement.
                    </p>
                </div>
            `;
        }
        const options = destinations.map((destination) => `
            <option value="${escapeHtml(String(destination.id))}">
                ${escapeHtml(operatorLabel(destination.operator))} · ${escapeHtml(destination.masked_account)}
            </option>
        `).join('');
        return `
                <form id="withdrawForm" class="flow-withdraw-form" novalidate>
                    <div class="wd-field flow-card">
                        <label for="withdrawalAmount">Montant à retirer</label>
                        <input id="withdrawalAmount" name="amount" type="number" inputmode="numeric"
                               min="1" max="${escapeHtml(String(available))}" step="1"
                               value="${escapeHtml(String(available))}" required>
                        <small>Solde disponible : ${escapeHtml(formatAmount(available, currency))}</small>
                    </div>
                    <div class="wd-field flow-card">
                        <label for="withdrawalDestination">Compte de réception enregistré</label>
                        <select id="withdrawalDestination" name="destination" required>
                            ${options}
                        </select>
                        <small>Numéro masqué : le titulaire et le compte sont vérifiés par la plateforme.</small>
                    </div>
                    <p class="flow-notice">
                        Les frais et le montant reçu seront affichés avant confirmation.
                        Vous serez informé dès que le versement sera confirmé par notre équipe.
                    </p>
                    <button class="flow-btn" type="submit" id="withdrawalQuote">Continuer</button>
                </form>
        `;
    }

    _destinationForm() {
        const options = OPERATORS.map((operator) => `
            <option value="${escapeHtml(operator.value)}">${escapeHtml(operator.label)}</option>
        `).join('');
        return `
            <div class="wd-card">
                <h2>Ajouter une destination</h2>
                <form id="destinationForm" novalidate>
                    <div class="wd-field">
                        <label for="destinationOperator">Opérateur</label>
                        <select id="destinationOperator" name="operator" required>${options}</select>
                    </div>
                    <div class="wd-field">
                        <label for="destinationNumber">Numéro de retrait</label>
                        <input id="destinationNumber" name="accountNumber" type="tel"
                               placeholder="+225 07 00 00 00 12" required>
                        <small>Format international : +225 puis 10 chiffres.</small>
                    </div>
                    <div class="wd-field">
                        <label for="destinationHolder">Titulaire du compte</label>
                        <input id="destinationHolder" name="accountHolder" type="text"
                               placeholder="Nom et prénoms" required>
                    </div>
                    <button class="wd-primary" type="submit" id="destinationSubmit">Enregistrer</button>
                </form>
            </div>
            <div class="wd-destinations">${this._destinationItems()}</div>
        `;
    }

    _destinationItems() {
        if (!this._destinations.length) return '';
        return this._destinations.map((destination) => `
            <article class="wd-item">
                <div class="wd-item-top">
                    <strong>${escapeHtml(operatorLabel(destination.operator))}</strong>
                    <span>${escapeHtml(destination.masked_account)}</span>
                </div>
                <div class="wd-badges">
                    <span class="wd-badge ${escapeHtml(destination.status || '')}">
                        ${escapeHtml(destinationStatusLabel(destination.status))}
                    </span>
                </div>
            </article>
        `).join('');
    }

    _historyItem(payout) {
        const currency = payout.currency || 'XOF';
        const fee = Number(payout.transfer_fee || 0);
        return `
            <article class="wd-item">
                <div class="wd-item-top">
                    <strong>${escapeHtml(formatAmount(payout.recipient_amount, currency))}</strong>
                    <span>${escapeHtml(this._destinationLabel(payout.destination_id))}</span>
                </div>
                <div class="wd-badges">
                    <span class="wd-badge ${escapeHtml(payout.status || '')}">
                        ${escapeHtml(payoutStatusLabel(payout.status))}
                    </span>
                    <span class="wd-badge">Frais ${escapeHtml(formatAmount(fee, currency))}</span>
                </div>
            </article>
        `;
    }

    _history() {
        if (!this._payouts.length) {
            return `
                <div class="wd-state">
                    <i class="material-icons-round">payments</i>
                    <p>Aucun retrait demandé pour le moment.</p>
                </div>
            `;
        }
        return `
            <div class="wd-history">${this._payouts.map((payout) => this._historyItem(payout)).join('')}</div>
            ${this._nextCursor ? '<button class="wd-more" type="button" id="withdrawalMore">Charger plus</button>' : ''}
        `;
    }

    _render() {
        const body = this.querySelector('#withdrawalBody');
        if (!body) return;
        const hasVerified = this._verifiedDestinations().length > 0;

        body.innerHTML = `
            ${this._hero()}
            ${this._quote ? this._quoteCard() : this._requestCard()}
            ${hasVerified ? '' : this._destinationForm()}
            <details class="wd-card flow-details">
                <summary>Historique de tous mes retraits</summary>
                ${this._history()}
            </details>
        `;

        this.querySelector('#withdrawForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._requestQuote();
        });
        this.querySelector('#destinationForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._createDestination();
        });
        this.querySelector('#withdrawalConfirm')?.addEventListener('click', () => this._confirmPayout());
        this.querySelector('#withdrawalCancel')?.addEventListener('click', () => {
            this._quote = null;
            this._quoteKey = null;
            this._payoutKey = null;
            this._render();
        });
        this.querySelector('#withdrawalMore')?.addEventListener('click', () => this._loadMorePayouts());
    }

    _setBusy(busy) {
        this._busy = busy;
        this.querySelectorAll('button').forEach((button) => {
            button.disabled = busy;
        });
    }

    async _requestQuote() {
        if (this._busy) return;
        const form = this.querySelector('#withdrawForm');
        if (!form) return;
        const amount = Number.parseInt(form.elements.amount.value, 10);
        const available = Number(this._wallet?.available || 0);
        if (!Number.isInteger(amount) || amount < 1) {
            notify('Saisissez un montant entier supérieur à zéro.', 'error');
            return;
        }
        if (amount > available) {
            notify('Le montant dépasse le solde disponible.', 'error');
            return;
        }
        const destinationId = form.elements.destination.value;
        if (!destinationId) {
            notify('Sélectionnez une destination vérifiée.', 'error');
            return;
        }

        this._setBusy(true);
        try {
            const { api } = await import('../../api.js');
            this._quoteKey = this._quoteKey || newIdempotencyKey();
            this._quote = await api.createPayoutQuote({
                destinationId,
                desireId: this._desireId,
                selectedBalance: amount,
                idempotencyKey: this._quoteKey,
            });
            this._payoutKey = null;
            this._render();
        } catch (error) {
            this._quoteKey = null;
            notify(payoutErrorMessage(error), 'error');
        } finally {
            this._setBusy(false);
        }
    }

    async _confirmPayout() {
        if (this._busy || !this._quote) return;
        this._setBusy(true);
        try {
            const { api } = await import('../../api.js');
            this._payoutKey = this._payoutKey || newIdempotencyKey();
            await api.requestPayout({ quoteId: this._quote.id, idempotencyKey: this._payoutKey });
            this._quote = null;
            this._quoteKey = null;
            this._payoutKey = null;
            notify('Retrait demandé : les fonds sont réservés jusqu’au versement manuel.', 'success');
            await this._load();
        } catch (error) {
            if (error?.code === 'PAYOUT_QUOTE_EXPIRED' || error?.code === 'PAYOUT_QUOTE_NOT_FOUND') {
                this._quote = null;
                this._quoteKey = null;
                await this._load();
            }
            notify(payoutErrorMessage(error), 'error');
        } finally {
            this._setBusy(false);
        }
    }

    async _createDestination() {
        if (this._busy) return;
        const form = this.querySelector('#destinationForm');
        if (!form) return;
        const operator = form.elements.operator.value;
        const accountNumber = form.elements.accountNumber.value.trim();
        const accountHolder = form.elements.accountHolder.value.trim();
        if (!accountNumber || !accountHolder) {
            notify('Renseignez le numéro et le titulaire du compte.', 'error');
            return;
        }

        this._setBusy(true);
        try {
            const { api } = await import('../../api.js');
            await api.createPayoutDestination({
                country: 'CI',
                operator,
                accountNumber,
                accountHolder,
                idempotencyKey: newIdempotencyKey(),
            });
            notify('Destination enregistrée : elle attend la vérification financière.', 'success');
            await this._load();
        } catch (error) {
            notify(payoutErrorMessage(error), 'error');
        } finally {
            this._setBusy(false);
        }
    }
}

customElements.define('app-withdrawal-page', WithdrawalPage);
