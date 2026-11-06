/**
 * ReceiptPage — reçu stable d'un paiement confirmé (PAR-04).
 *
 * Le reçu est dérivé de l'écriture d'encaissement : son numéro ne change pas,
 * même après une annulation. La page est accessible par
 * `#receipt/<payment_id>` et depuis le profil.
 */
import { escapeHtml } from '../../utils/escapeHtml.js';
import {
    clearReceiptTarget,
    formatAmount,
    formatDeadline,
    readReceiptTarget,
} from '../../utils/paymentFlow.js';

export class ReceiptPage extends HTMLElement {
    constructor() {
        super();
        this._paymentId = null;
        this._receipt = null;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .receipt-page { height: 100svh; overflow-y: auto; background: var(--bg-main, #f5f6fa); }
                .receipt-header {
                    display: flex; align-items: center; gap: 12px;
                    padding: 18px 20px; position: sticky; top: 0; z-index: 5;
                    background: var(--glass-bg, rgba(255,255,255,0.9));
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--border-light, #e5e7eb);
                }
                .receipt-header h1 { font-size: 17px; font-weight: 700; color: var(--text-main, #111827); margin: 0; }
                .receipt-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
                .receipt-card {
                    background: var(--bg-card, #fff); border-radius: 20px; padding: 26px;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                    border: 1px solid var(--border-light, #e5e7eb);
                }
                .receipt-brand { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--primary, #6366f1); }
                .receipt-number { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; color: var(--text-main, #111827); margin: 6px 0 2px; }
                .receipt-date { font-size: 13px; color: var(--text-muted, #6b7280); margin: 0 0 20px; }
                .receipt-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px dashed #e5e7eb; font-size: 14px; }
                .receipt-row span:first-child { color: var(--text-muted, #6b7280); }
                .receipt-row span:last-child { color: var(--text-main, #111827); font-weight: 600; text-align: right; word-break: break-all; }
                .receipt-total { font-size: 18px; }
                .receipt-total span:last-child { font-weight: 800; white-space: nowrap; word-break: normal; }
                .receipt-actions { display: flex; gap: 10px; }
                .receipt-action-btn {
                    flex: 1; border: none; border-radius: 100px; padding: 13px 18px;
                    background: var(--primary, #6366f1); color: white; font-weight: 700;
                    font-size: 14px; cursor: pointer;
                }
                .receipt-action-btn.secondary {
                    background: var(--bg-card, #fff); color: var(--text-main, #111827);
                    border: 1px solid var(--border-light, #e5e7eb);
                }
                .receipt-state {
                    display: flex; flex-direction: column; align-items: center; gap: 10px;
                    padding: 48px 20px; text-align: center; color: var(--text-muted, #6b7280);
                }
                .receipt-state .material-icons-round { font-size: 44px; opacity: 0.55; }
                .receipt-spinner {
                    width: 34px; height: 34px; border-radius: 50%;
                    border: 3px solid rgba(99,102,241,0.2); border-top-color: var(--primary, #6366f1);
                    animation: receipt-spin 0.9s linear infinite;
                }
                @keyframes receipt-spin { to { transform: rotate(360deg); } }
                @media print {
                    .receipt-header, .receipt-actions { display: none !important; }
                    .receipt-page { height: auto; background: white; }
                    .receipt-body { padding: 0; }
                    .receipt-card { --bg-card: white; --text-main: #111827; --text-muted: #475569; box-shadow: none; border: none; }
                }
            </style>

            <section class="page-section receipt-page" id="receiptPage" style="display: none;">
                <header class="receipt-header">
                    <button class="round-icon-btn back-from-receipt" type="button" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <h1>Reçu de paiement</h1>
                </header>
                <div class="receipt-body" id="receiptBody">
                    <div class="receipt-state">
                        <div class="receipt-spinner"></div>
                        <p>Chargement du reçu…</p>
                    </div>
                </div>
            </section>
        `;

        this.querySelector('.back-from-receipt')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show(context = {}) {
        const stored = readReceiptTarget();
        clearReceiptTarget();
        this._paymentId = context.paymentId || stored || null;
        const page = this.querySelector('#receiptPage');
        if (page) page.style.display = 'block';
        this._load();
    }

    hide() {
        const page = this.querySelector('#receiptPage');
        if (page) page.style.display = 'none';
    }

    _renderState(icon, message, { retry = false } = {}) {
        const body = this.querySelector('#receiptBody');
        if (!body) return;
        body.innerHTML = `
            <div class="receipt-state">
                <i class="material-icons-round">${escapeHtml(icon)}</i>
                <p>${escapeHtml(message)}</p>
                ${retry ? '<button class="receipt-action-btn" type="button" id="receiptRetryBtn">Réessayer</button>' : ''}
            </div>
        `;
        if (retry) {
            this.querySelector('#receiptRetryBtn')?.addEventListener('click', () => this._load());
        }
    }

    async _load() {
        if (!this._paymentId) {
            this._renderState('receipt_long', "Aucun reçu n'est associé à ce lien.");
            return;
        }
        this._renderState('hourglass_empty', 'Chargement du reçu…');
        try {
            const { api } = await import('../../api.js');
            const receipt = await api.getReceipt(this._paymentId);
            this._receipt = receipt;
            this._renderReceipt(receipt);
        } catch (error) {
            const message = error?.status === 404
                ? "Ce reçu n'est pas encore disponible. Il apparaît dès que le paiement est confirmé."
                : (error?.message || 'Impossible de charger le reçu.');
            this._renderState('receipt_long', message, { retry: error?.status !== 404 });
        }
    }

    _renderReceipt(receipt) {
        const body = this.querySelector('#receiptBody');
        if (!body || !receipt) return;
        const amount = formatAmount(receipt.amount, receipt.currency);
        const issuedAt = formatDeadline(receipt.issued_at);

        body.innerHTML = `
            <div class="receipt-card" id="receiptCard">
                <span class="receipt-brand">Distrax</span>
                <p class="receipt-number">${escapeHtml(receipt.number || '—')}</p>
                <p class="receipt-date">Émis le ${escapeHtml(issuedAt || '—')}</p>
                <div class="receipt-row">
                    <span>Paiement</span>
                    <span>${escapeHtml(String(receipt.payment_id || '').slice(0, 8))}…</span>
                </div>
                <div class="receipt-row">
                    <span>Référence comptable</span>
                    <span>${escapeHtml(String(receipt.id || '').slice(0, 8))}…</span>
                </div>
                <div class="receipt-row receipt-total">
                    <span>Montant réglé</span>
                    <span>${escapeHtml(amount)}</span>
                </div>
            </div>
            <div class="receipt-actions">
                <button class="receipt-action-btn" type="button" id="receiptPrintBtn">
                    Imprimer / PDF
                </button>
                <button class="receipt-action-btn secondary" type="button" id="receiptBackBtn">
                    Retour
                </button>
            </div>
        `;

        this.querySelector('#receiptPrintBtn')?.addEventListener('click', () => window.print());
        this.querySelector('#receiptBackBtn')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }
}

customElements.define('app-receipt-page', ReceiptPage);
