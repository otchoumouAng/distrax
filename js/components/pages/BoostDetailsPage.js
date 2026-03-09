/**
 * BoostDetailsPage — Overlay de visualisation d'un boost actif.
 * Affiché quand l'utilisateur clique sur le bouton "Boost en cours" d'une envie.
 *
 * Usage :
 *   boostDetailsPage.open({ desireId: '...', desireTitle: '...' })
 *   boostDetailsPage.close()
 */

import { api } from '../../api.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

/** Mapping slug → label humain pour les zones */
const ZONE_LABELS = {
    commune:      'Ma commune',
    tout_abidjan: 'Tout Abidjan',
    cote_divoire: "Côte d'Ivoire",
};

/**
 * Formate un nombre d'heures en texte lisible.
 * 24 → "1 jour", 72 → "3 jours", 36 → "1j 12h"
 */
function formatDuration(hours) {
    if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    const rem  = hours % 24;
    const d    = `${days} jour${days > 1 ? 's' : ''}`;
    return rem === 0 ? d : `${d} ${rem}h`;
}

/**
 * Formate une date ISO en texte court (lun. 9 mars à 14h30).
 */
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Calcule l'avancement du boost et le temps restant.
 * @returns {{ progress: number, remainingText: string, expired: boolean }}
 */
function computeProgress(boost) {
    const start     = new Date(boost.activated_at).getTime();
    const end       = new Date(boost.expires_at).getTime();
    const now       = Date.now();
    const elapsed   = Math.max(0, now - start);
    const total     = Math.max(1, end - start);
    const progress  = Math.min(100, Math.round(elapsed / total * 100));
    const remaining = end - now;

    if (remaining <= 0) {
        return { progress: 100, remainingText: 'Expiré', expired: true };
    }

    const totalMins = Math.floor(remaining / 60_000);
    const days      = Math.floor(totalMins / 1440);
    const hours     = Math.floor((totalMins % 1440) / 60);
    const mins      = totalMins % 60;

    let text;
    if (days > 0 && hours > 0)     text = `${days}j ${hours}h restants`;
    else if (days > 0)              text = `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
    else if (hours > 0 && mins > 0) text = `${hours}h ${mins}min restantes`;
    else if (hours > 0)             text = `${hours} heure${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
    else                            text = `${mins} minute${mins !== 1 ? 's' : ''} restante${mins !== 1 ? 's' : ''}`;

    return { progress, remainingText: text, expired: false };
}

// ─── Component ───────────────────────────────────────────────────────────────

export class BoostDetailsPage extends HTMLElement {
    constructor() {
        super();
        this._desireId    = null;
        this._desireTitle = '';
        this._boost       = null;
        this._timer       = null;
    }

    connectedCallback() {
        this.style.cssText = `
            display:none; position:fixed; inset:0;
            z-index:1001; background:var(--bg-primary,#fff);
            overflow-y:auto; -webkit-overflow-scrolling:touch;
        `;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    async open({ desireId, desireTitle }) {
        this._desireId    = desireId;
        this._desireTitle = desireTitle || 'Envie';
        this._renderSkeleton();
        this.style.display = 'block';
        document.body.style.overflow = 'hidden';

        try {
            this._boost = await api.getActiveBoost(desireId);
            this._renderDetails();
            this._startTimer();
        } catch {
            this._renderEmpty();
        }
    }

    close() {
        this.style.display           = 'none';
        document.body.style.overflow = '';
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._boost = null;
    }

    // ─── Render states ───────────────────────────────────────────────────────

    _renderSkeleton() {
        this.innerHTML = `
            ${this._headerHTML('Boost actif')}
            <div style="padding:20px; display:flex; flex-direction:column; gap:14px;">
                <div style="height:88px; background:var(--border-color,#e5e7eb); border-radius:16px;
                            animation:bdpPulse 1.5s ease-in-out infinite;"></div>
                <div style="height:108px; background:var(--border-color,#e5e7eb); border-radius:16px;
                            animation:bdpPulse 1.5s ease-in-out infinite 0.1s;"></div>
                <div style="height:160px; background:var(--border-color,#e5e7eb); border-radius:16px;
                            animation:bdpPulse 1.5s ease-in-out infinite 0.2s;"></div>
            </div>
            <style>
                @keyframes bdpPulse {
                    0%,100% { opacity:1; } 50% { opacity:.45; }
                }
            </style>
        `;
        this._attachBackBtn();
    }

    _renderEmpty() {
        this.innerHTML = `
            ${this._headerHTML('Boost actif')}
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                        padding:60px 20px; gap:16px; text-align:center;">
                <div style="width:80px; height:80px; background:var(--bg-secondary,#f3f4f6);
                            border-radius:20px; display:flex; align-items:center; justify-content:center;">
                    <i class="material-icons-round" style="font-size:40px; color:var(--text-muted);">rocket_launch</i>
                </div>
                <p style="font-size:16px; font-weight:700; color:var(--text-primary); margin:0;">
                    Aucun boost actif
                </p>
                <p style="font-size:14px; color:var(--text-muted); margin:0;">
                    Aucun boost en cours pour cette envie.
                </p>
                <button id="bdpClose"
                    style="margin-top:8px; padding:12px 32px; background:var(--primary,#6366f1);
                           color:#fff; border:none; border-radius:14px; cursor:pointer;
                           font-size:15px; font-weight:600;">
                    Fermer
                </button>
            </div>
        `;
        this._attachBackBtn();
        this.querySelector('#bdpClose')?.addEventListener('click', () => this.close());
    }

    _renderDetails() {
        const b = this._boost;
        const { progress, remainingText, expired } = computeProgress(b);

        const statusColor   = expired ? '#ef4444' : '#10b981';
        const progressColor = expired ? '#ef4444' : 'var(--primary,#6366f1)';
        const statusLabel   = expired ? 'Expiré'  : 'Actif';
        const statusIcon    = expired ? 'timer_off' : 'bolt';
        const pctLeft       = 100 - progress;
        const zoneLabel     = ZONE_LABELS[b.zone] || b.zone;
        const priceFormatted = b.price_xof.toLocaleString('fr-FR');

        this.innerHTML = `
            <style>
                @keyframes bdpSlideIn {
                    from { opacity:0; transform:translateY(24px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                .bdp-card { animation:bdpSlideIn .35s ease both; }
            </style>

            <!-- Header sticky -->
            <div style="display:flex; align-items:center; gap:12px; padding:16px 20px;
                        border-bottom:1px solid var(--border-color,#e5e7eb);
                        position:sticky; top:0; background:var(--bg-primary,#fff); z-index:10;">
                <button id="bdpBack"
                    style="background:none; border:none; cursor:pointer;
                           display:flex; align-items:center; color:var(--text-primary); padding:4px;
                           border-radius:8px;">
                    <i class="material-icons-round">arrow_back</i>
                </button>
                <h1 style="font-size:18px; font-weight:700; flex:1; margin:0;">Détails du boost</h1>
                <span style="display:inline-flex; align-items:center; gap:4px;
                             background:${statusColor}20; color:${statusColor};
                             padding:5px 12px; border-radius:20px; font-size:13px; font-weight:700;">
                    <i class="material-icons-round" style="font-size:14px;">${statusIcon}</i>
                    ${statusLabel}
                </span>
            </div>

            <!-- Content -->
            <div style="padding:20px; display:flex; flex-direction:column; gap:16px; padding-bottom:36px;">

                <!-- Desire banner -->
                <div class="bdp-card"
                    style="background:linear-gradient(135deg,#10b981,#059669); border-radius:16px;
                           padding:18px 20px; display:flex; align-items:center; gap:14px; color:#fff;
                           animation-delay:.05s;">
                    <div style="width:48px; height:48px; background:rgba(255,255,255,.22);
                                border-radius:12px; display:flex; align-items:center; justify-content:center;
                                flex-shrink:0;">
                        <i class="material-icons-round" style="font-size:24px;">rocket_launch</i>
                    </div>
                    <div style="overflow:hidden;">
                        <div style="font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden;
                                    text-overflow:ellipsis; margin-bottom:3px;">
                            ${escapeHtml(this._desireTitle)}
                        </div>
                        <div style="font-size:12px; opacity:.85;">Envie en cours de boost</div>
                    </div>
                </div>

                <!-- Progress block -->
                <div class="bdp-card"
                    style="background:var(--bg-secondary,#f9fafb); border-radius:16px; padding:20px;
                           animation-delay:.1s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="font-size:14px; font-weight:600; color:var(--text-primary);">
                            Temps restant
                        </span>
                        <span id="bdpPct"
                            style="font-size:15px; font-weight:800; color:${progressColor};">
                            ${pctLeft}%
                        </span>
                    </div>
                    <!-- Track -->
                    <div style="background:var(--border-color,#e5e7eb); border-radius:99px;
                                height:10px; overflow:hidden; margin-bottom:14px;">
                        <div id="bdpBar"
                            style="height:100%; width:${progress}%; background:${progressColor};
                                   border-radius:99px; transition:width 1s ease;">
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                        <span id="bdpRemaining"
                            style="font-size:15px; font-weight:700;
                                   color:${expired ? '#ef4444' : 'var(--text-primary)'};
                                   flex-shrink:0;">
                            ${remainingText}
                        </span>
                        <span style="font-size:12px; color:var(--text-muted); text-align:right; line-height:1.4;">
                            Expire le<br><strong>${formatDate(b.expires_at)}</strong>
                        </span>
                    </div>
                </div>

                <!-- Details rows -->
                <div class="bdp-card"
                    style="border-radius:16px; border:1px solid var(--border-color,#e5e7eb);
                           overflow:hidden; animation-delay:.15s;">
                    ${this._detailRow('location_on', 'Zone de diffusion', escapeHtml(zoneLabel), true)}
                    ${this._detailRow('schedule',    'Durée du boost',    formatDuration(b.duration_hours), true)}
                    ${this._detailRow('payments',    'Prix payé',         `${priceFormatted} FCFA`, true)}
                    ${this._detailRow('play_circle', 'Activé le',         formatDate(b.activated_at), false)}
                </div>

                <!-- Close -->
                <button id="bdpClose"
                    style="width:100%; padding:14px; background:var(--bg-secondary,#f3f4f6);
                           color:var(--text-primary); border:none; border-radius:14px; cursor:pointer;
                           font-size:15px; font-weight:600;">
                    Fermer
                </button>
            </div>
        `;

        this.querySelector('#bdpBack')?.addEventListener('click',  () => this.close());
        this.querySelector('#bdpClose')?.addEventListener('click', () => this.close());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    _headerHTML(title) {
        return `
            <div style="display:flex; align-items:center; gap:12px; padding:16px 20px;
                        border-bottom:1px solid var(--border-color,#e5e7eb);
                        position:sticky; top:0; background:var(--bg-primary,#fff); z-index:10;">
                <button id="bdpBack"
                    style="background:none; border:none; cursor:pointer;
                           display:flex; align-items:center; color:var(--text-primary); padding:4px;">
                    <i class="material-icons-round">arrow_back</i>
                </button>
                <h1 style="font-size:18px; font-weight:700; flex:1; margin:0;">${title}</h1>
            </div>
        `;
    }

    _attachBackBtn() {
        this.querySelector('#bdpBack')?.addEventListener('click', () => this.close());
    }

    _detailRow(icon, label, value, withBorder) {
        const border = withBorder ? 'border-bottom:1px solid var(--border-color,#e5e7eb);' : '';
        return `
            <div style="display:flex; align-items:center; gap:14px; padding:14px 16px; ${border}">
                <i class="material-icons-round"
                   style="font-size:20px; color:var(--primary,#6366f1); flex-shrink:0;">
                   ${icon}
                </i>
                <span style="font-size:13px; color:var(--text-muted); flex:1;">${label}</span>
                <span style="font-size:14px; font-weight:700; color:var(--text-primary);">${value}</span>
            </div>
        `;
    }

    // ─── Live timer (tick every 30 s) ────────────────────────────────────────

    _startTimer() {
        if (this._timer) clearInterval(this._timer);
        this._timer = setInterval(() => this._tick(), 30_000);
    }

    _tick() {
        if (!this._boost) return;
        const { progress, remainingText, expired } = computeProgress(this._boost);
        const progressColor = expired ? '#ef4444' : 'var(--primary,#6366f1)';
        const pctLeft       = 100 - progress;

        const bar = this.querySelector('#bdpBar');
        const pct = this.querySelector('#bdpPct');
        const rem = this.querySelector('#bdpRemaining');
        if (bar) bar.style.width = `${progress}%`;
        if (pct) { pct.textContent = `${pctLeft}%`; pct.style.color = progressColor; }
        if (rem) { rem.textContent = remainingText;  rem.style.color = expired ? '#ef4444' : 'var(--text-primary)'; }
    }
}

customElements.define('app-boost-details-page', BoostDetailsPage);
