/**
 * confirm.js — Modal de confirmation stylisé et accessible.
 *
 * Usage:
 *   import { showConfirm } from '../utils/confirm.js';
 *   const confirmed = await showConfirm({ title: 'Quitter ?', message: '...' });
 *   if (confirmed) { ... }
 */

/**
 * Affiche un modal de confirmation.
 * @param {Object} opts
 * @param {string} opts.title         - Titre du modal
 * @param {string} opts.message       - Message de confirmation
 * @param {string} [opts.confirmLabel='Confirmer'] - Texte du bouton de confirmation
 * @param {string} [opts.cancelLabel='Annuler']    - Texte du bouton d'annulation
 * @param {'danger'|'warning'|'info'} [opts.type='danger'] - Style du bouton de confirmation
 * @returns {Promise<boolean>} true si l'utilisateur confirme, false sinon
 */
export function showConfirm({
    title = 'Confirmation',
    message = 'Êtes-vous sûr ?',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    type = 'danger',
} = {}) {
    return new Promise((resolve) => {
        const colors = { danger: '#ef4444', warning: '#f59e0b', info: '#6366f1' };
        const confirmColor = colors[type] || colors.danger;

        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:10000',
            'background:rgba(0,0,0,0.5)',
            'display:flex', 'align-items:flex-end', 'justify-content:center',
            'padding:0 0 env(safe-area-inset-bottom,0)',
            'animation:fadeIn 0.18s ease',
        ].join(';');

        overlay.innerHTML = `
            <style>
                @keyframes slideUp { from { transform: translateY(100%); opacity:0; } to { transform: translateY(0); opacity:1; } }
                @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
            </style>
            <div style="
                background: var(--bg-card, #fff);
                border-radius: 24px 24px 0 0;
                padding: 32px 24px 40px;
                width: 100%;
                max-width: 480px;
                animation: slideUp 0.22s cubic-bezier(.34,1.56,.64,1);
                box-shadow: 0 -4px 40px rgba(0,0,0,0.15);
            ">
                <div style="width:40px;height:4px;background:var(--border-light,#e2e8f0);border-radius:2px;margin:0 auto 24px;"></div>
                <p style="font-size:18px;font-weight:700;color:var(--text-main);margin:0 0 10px;">${title}</p>
                <p style="font-size:14px;color:var(--text-muted,#64748b);margin:0 0 28px;line-height:1.5;">${message}</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <button id="confirmYes" style="
                        background:${confirmColor};color:#fff;border:none;
                        padding:14px;border-radius:14px;font-size:15px;font-weight:700;
                        cursor:pointer;width:100%;
                    ">${confirmLabel}</button>
                    <button id="confirmNo" style="
                        background:var(--bg-main,#f8fafc);color:var(--text-main);
                        border:1px solid var(--border-light,#e2e8f0);
                        padding:14px;border-radius:14px;font-size:15px;font-weight:600;
                        cursor:pointer;width:100%;
                    ">${cancelLabel}</button>
                </div>
            </div>
        `;

        const close = (result) => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.15s';
            setTimeout(() => overlay.remove(), 150);
            resolve(result);
        };

        overlay.querySelector('#confirmYes').addEventListener('click', () => close(true));
        overlay.querySelector('#confirmNo').addEventListener('click', () => close(false));
        // Fermer en cliquant sur le fond semi-transparent
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

        document.body.appendChild(overlay);
    });
}
