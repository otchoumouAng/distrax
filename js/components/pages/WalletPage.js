/**
 * WalletPage — solde global et détail par envie (ORG-05).
 *
 * Les catégories du journal ne sont jamais fusionnées : en attente, disponible,
 * retenu, en retrait et versé restent affichés séparément. Le détail d'une envie
 * est chargé à la demande avec le même contrat (`desire_id`).
 */
import { escapeHtml } from '../../utils/escapeHtml.js';
import { formatAmount } from '../../utils/paymentFlow.js';
import { isPlatformPaidDesire, rememberOrganizerTarget, WITHDRAWAL_TARGET_KEY } from '../../utils/organizerView.js';

export class WalletPage extends HTMLElement {
    constructor() {
        super();
        this._wallet = null;
        this._desires = [];
        this._loading = false;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .wallet-page { height: 100svh; overflow-y: auto; background: var(--bg-main, #f5f6fa); }
                .wallet-header {
                    display: flex; align-items: center; gap: 12px;
                    padding: 18px 20px; position: sticky; top: 0; z-index: 5;
                    background: var(--glass-bg, rgba(255,255,255,0.9));
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid var(--border-light, #e5e7eb);
                }
                .wallet-header h1 { font-size: 17px; font-weight: 700; color: var(--text-main, #111827); margin: 0; }
                .wallet-body { padding: 16px 16px 28px; display: flex; flex-direction: column; gap: 16px; }
                .wallet-hero {
                    background: linear-gradient(135deg, #0ea5e9, #2563eb);
                    color: white; border-radius: 20px; padding: 22px;
                    display: flex; flex-direction: column; gap: 6px;
                }
                .wallet-hero span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85; }
                .wallet-hero strong { font-size: 30px; font-weight: 800; line-height: 1.1; }
                .wallet-hero small { font-size: 11px; opacity: 0.8; }
                .wallet-withdraw-btn {
                    align-self: flex-start; margin-top: 8px; border: none; border-radius: 100px;
                    padding: 10px 18px; background: rgba(255,255,255,0.95); color: #1d4ed8;
                    font-weight: 700; font-size: 13px; cursor: pointer;
                }
                .wallet-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
                .wallet-cell {
                    background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 14px; padding: 12px 14px;
                }
                .wallet-cell span {
                    display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.06em; color: var(--text-muted, #6b7280);
                }
                .wallet-cell strong { display: block; margin-top: 4px; font-size: 16px; color: var(--text-main, #111827); }
                .wallet-section-title {
                    font-size: 13px; font-weight: 700; color: var(--text-muted, #6b7280);
                    text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0 0;
                }
                .wallet-desire {
                    background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e5e7eb);
                    border-radius: 14px; padding: 14px;
                }
                .wallet-desire-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
                .wallet-desire-head strong { font-size: 15px; color: var(--text-main, #111827); }
                .wallet-desire-head small { display: block; margin-top: 2px; font-size: 12px; color: var(--text-muted, #6b7280); }
                .wallet-detail-btn {
                    border: 1px solid var(--border-light, #e5e7eb); border-radius: 100px;
                    padding: 8px 14px; background: var(--bg-main, #f9fafb);
                    color: var(--primary, #0ea5e9); font-weight: 700; font-size: 12px; cursor: pointer;
                }
                .wallet-detail-btn:disabled { opacity: 0.55; cursor: default; }
                .wallet-detail { margin-top: 12px; display: none; }
                .wallet-detail.open { display: block; }
                .wallet-detail-withdraw { margin-top: 12px; }
                .wallet-state {
                    display: flex; flex-direction: column; align-items: center; gap: 10px;
                    padding: 44px 20px; text-align: center; color: var(--text-muted, #6b7280);
                }
                .wallet-state .material-icons-round { font-size: 44px; opacity: 0.55; }
                .wallet-retry-btn {
                    border: none; border-radius: 100px; padding: 11px 22px;
                    background: var(--primary, #0ea5e9); color: white; font-weight: 600;
                    font-size: 13px; cursor: pointer;
                }
                .wallet-spinner {
                    width: 34px; height: 34px; border-radius: 50%;
                    border: 3px solid rgba(14,165,233,0.2); border-top-color: var(--primary, #0ea5e9);
                    animation: wallet-spin 0.9s linear infinite;
                }
                @keyframes wallet-spin { to { transform: rotate(360deg); } }
            </style>

            <section class="page-section wallet-page" id="walletPage" style="display: none;">
                <header class="wallet-header">
                    <button class="round-icon-btn back-from-wallet" type="button" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <h1>Portefeuille</h1>
                </header>
                <div class="wallet-body" id="walletBody">
                    <div class="wallet-state">
                        <div class="wallet-spinner"></div>
                        <p>Chargement du portefeuille…</p>
                    </div>
                </div>
            </section>
        `;

        this.querySelector('.back-from-wallet')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });
    }

    show() {
        const page = this.querySelector('#walletPage');
        if (page) page.style.display = 'block';
        this._load();
    }

    hide() {
        const page = this.querySelector('#walletPage');
        if (page) page.style.display = 'none';
    }

    _renderState(icon, message, { retry = false } = {}) {
        const body = this.querySelector('#walletBody');
        if (!body) return;
        body.innerHTML = `
            <div class="wallet-state">
                <i class="material-icons-round">${escapeHtml(icon)}</i>
                <p>${escapeHtml(message)}</p>
                ${retry ? '<button class="wallet-retry-btn" type="button" id="walletRetryBtn">Réessayer</button>' : ''}
            </div>
        `;
        if (retry) {
            this.querySelector('#walletRetryBtn')?.addEventListener('click', () => this._load());
        }
    }

    async _load() {
        if (this._loading) return;
        this._loading = true;
        this._renderState('hourglass_empty', 'Chargement du portefeuille…');
        try {
            const { api } = await import('../../api.js');
            const [wallet, desires] = await Promise.all([
                api.getOrganizerWallet(),
                api.getMyDesires(),
            ]);
            this._wallet = wallet;
            this._desires = (Array.isArray(desires) ? desires : []).filter(isPlatformPaidDesire);
            this._render();
        } catch (error) {
            const message = error?.status === 403
                ? 'Le portefeuille est réservé aux organisateurs.'
                : (error?.message || 'Impossible de charger le portefeuille.');
            this._renderState('account_balance_wallet', message, { retry: error?.status !== 403 });
        } finally {
            this._loading = false;
        }
    }

    _cell(label, amount, currency) {
        return `
            <div class="wallet-cell">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(formatAmount(amount, currency))}</strong>
            </div>
        `;
    }

    _grid(values, currency) {
        return `
            <div class="wallet-grid">
                ${this._cell('En attente', values.pending, currency)}
                ${this._cell('Disponible', values.available, currency)}
                ${this._cell('Retenu', values.held, currency)}
                ${this._cell('En retrait', values.payout_reserved, currency)}
                ${this._cell('Versé', values.paid_out, currency)}
            </div>
        `;
    }

    _render() {
        const body = this.querySelector('#walletBody');
        if (!body) return;
        const wallet = this._wallet || {};
        const currency = wallet.currency || 'XOF';

        const desireRows = this._desires.length
            ? this._desires.map((desire) => `
                <article class="wallet-desire" data-wallet-desire="${escapeHtml(String(desire.id))}">
                    <div class="wallet-desire-head">
                        <div>
                            <strong>${escapeHtml(desire.title || 'Envie')}</strong>
                            <small>${escapeHtml(formatAmount(desire.price_amount, desire.currency || currency))} par place</small>
                        </div>
                        <button class="wallet-detail-btn" type="button" data-wallet-detail="${escapeHtml(String(desire.id))}">
                            Détail
                        </button>
                    </div>
                    <div class="wallet-detail" id="walletDetail-${escapeHtml(String(desire.id))}"></div>
                </article>
            `).join('')
            : `
                <div class="wallet-state">
                    <i class="material-icons-round">event_note</i>
                    <p>Aucune envie payante encaissée par la plateforme.</p>
                </div>
            `;

        body.innerHTML = `
            <div class="wallet-hero">
                <span>Solde disponible</span>
                <strong>${escapeHtml(formatAmount(wallet.available, currency))}</strong>
                <small>${escapeHtml(wallet.currency || 'XOF')} · version ${escapeHtml(String(wallet.balance_version ?? 0))}</small>
                ${(wallet.allowed_actions || []).includes('request_payout') ? `
                    <button class="wallet-withdraw-btn" type="button" id="walletWithdrawBtn">Retirer</button>
                ` : ''}
            </div>
            ${this._grid(wallet, currency)}
            <h2 class="wallet-section-title">Détail par envie</h2>
            ${desireRows}
        `;

        this.querySelector('#walletWithdrawBtn')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('navigate-withdrawal'));
        });

        body.querySelectorAll('[data-wallet-detail]').forEach((button) => {
            button.addEventListener('click', () => {
                const desireId = button.getAttribute('data-wallet-detail');
                const container = this.querySelector(`#walletDetail-${desireId}`);
                this._toggleDesireDetail(desireId, button, container);
            });
        });
    }

    async _toggleDesireDetail(desireId, button, container) {
        if (!container) return;
        if (container.classList.contains('open')) {
            container.classList.remove('open');
            button.textContent = 'Détail';
            return;
        }
        container.classList.add('open');
        button.disabled = true;
        container.innerHTML = `
            <div class="wallet-state">
                <div class="wallet-spinner"></div>
                <p>Chargement…</p>
            </div>
        `;
        try {
            const { api } = await import('../../api.js');
            const values = await api.getOrganizerWallet({ desireId });
            container.innerHTML = `
                ${this._grid(values, values.currency || 'XOF')}
                ${Number(values.available) > 0 ? '<button type="button" class="wallet-detail-btn wallet-detail-withdraw">Retirer pour cette envie</button>' : ''}
            `;
            container.querySelector('.wallet-detail-withdraw')?.addEventListener('click', () => {
                rememberOrganizerTarget(WITHDRAWAL_TARGET_KEY, desireId);
                window.dispatchEvent(new CustomEvent('navigate-withdrawal'));
            });
            button.textContent = 'Masquer';
        } catch (error) {
            container.innerHTML = `
                <div class="wallet-state">
                    <p>${escapeHtml(error?.message || 'Impossible de charger le détail.')}</p>
                </div>
            `;
        } finally {
            button.disabled = false;
        }
    }
}

customElements.define('app-wallet-page', WalletPage);
