import { escapeHtml, safeUrl, DEFAULT_AVATAR_PATH, DEFAULT_AVATAR_DATA_URI } from '../../utils/escapeHtml.js';
import { resolveImageUrl, getImageVariantUrl } from '../../utils/imageUrl.js';

// Badges de statut du cycle de vie d'une envie (CAT-04).
// 'published' n'affiche aucun badge (cas nominal du catalogue).
const DESIRE_STATUS_BADGES = {
    draft: { label: 'Brouillon', icon: 'edit_note', tone: 'neutral' },
    cancelled: { label: 'Annulée', icon: 'cancel', tone: 'danger' },
    realized: { label: 'Réalisée', icon: 'check_circle', tone: 'success' },
    not_realized: { label: 'Non réalisée', icon: 'event_busy', tone: 'neutral' },
    expired: { label: 'Expirée', icon: 'history_toggle_off', tone: 'neutral' },
    archived: { label: 'Archivée', icon: 'archive', tone: 'neutral' },
};

/**
 * Retourne les informations d'affichage du badge de statut d'une envie,
 * ou null si aucun badge ne doit être affiché (statut publié/inconnu).
 * @param {string|undefined|null} status
 */
export function getDesireStatusBadge(status) {
    return DESIRE_STATUS_BADGES[String(status || '').toLowerCase()] || null;
}

export class DesireCard extends HTMLElement {
    static get observedAttributes() {
        return ['theme', 'title', 'author', 'time-ago', 'avatar', 'date', 'price', 'spots', 'icon', 'btn-text', 'commune', 'image', 'images', 'show-boost', 'mode', 'desire-id', 'description', 'has-active-boost', 'is-boosted', 'view-count', 'navigate-on-card', 'desire-status', 'is-past', 'needs-maintenance'];
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.isConnected) {
            this.render();
        }
    }

    render() {
        const theme = this.getAttribute('theme') || 'explore';
        const title = escapeHtml(this.getAttribute('title') || 'Titre par défaut');
        const author = escapeHtml(this.getAttribute('author') || 'Anonyme');
        const timeAgo = escapeHtml(this.getAttribute('time-ago') || 'À l\'instant');
        const avatarRaw = this.getAttribute('avatar') || DEFAULT_AVATAR_PATH;
        const avatar = resolveImageUrl(avatarRaw) || DEFAULT_AVATAR_PATH;
        const date = escapeHtml(this.getAttribute('date') || 'Maintenant');
        const price = escapeHtml(this.getAttribute('price') || 'Gratuit');
        const spots = escapeHtml(this.getAttribute('spots') || '');
        const icon = this.getAttribute('icon') || theme;
        const btnText = escapeHtml(this.getAttribute('btn-text') || 'Rejoindre');
        const commune = escapeHtml(this.getAttribute('commune') || 'Abidjan');
        const description = this.getAttribute('description') || '';
        const imagesAttr = this.getAttribute('images') || this.getAttribute('image') || '';
        let imagesArray = [];
        if (imagesAttr) {
            imagesArray = imagesAttr.split(',').map(img => img.trim()).filter(Boolean);
        }
        const firstImageCanonical = imagesArray.length > 0 ? (resolveImageUrl(imagesArray[0]) || '') : '';
        const firstImageVariant = firstImageCanonical ? (getImageVariantUrl(firstImageCanonical, 'medium') || firstImageCanonical) : '';
        const firstImageFallback = firstImageCanonical || '';

        // Convert attributes into HTML elements (user content already escaped)
        const spotsHtml = spots ? `<span class="spots-left">${spots}</span>` : '';
        const avatarFallback = escapeHtml(DEFAULT_AVATAR_DATA_URI);
        const avatarsStackHtml = `
            <div class="avatars-stack">
                <img src="${escapeHtml(avatar || DEFAULT_AVATAR_PATH)}" alt="${author}" class="user-avatar" data-fallback-avatar="${avatarFallback}" onerror="this.onerror=null;this.src=this.getAttribute('data-fallback-avatar')">
            </div>
        `;

        let priceIcon = 'payments';
        let dateIcon = 'calendar_today';
        const dateLower = (this.getAttribute('date') || '').toLowerCase();
        if (dateLower.includes('maintenant')) dateIcon = 'flash_on';
        if (dateLower.includes('après-midi') || dateLower.includes('heure')) dateIcon = 'schedule';

        const imageHtml = firstImageVariant
            ? `<div class="card-image"><img src="${escapeHtml(firstImageVariant)}" alt="" class="card-image-img" data-fallback="${escapeHtml(firstImageFallback)}" onerror="this.onerror=null;if(this.dataset.fallback)this.src=this.dataset.fallback"></div>`
            : '';

        const viewCount = this.getAttribute('view-count');
        const viewCountHtml = (viewCount != null && viewCount !== '') ? `<span class="meta-tag"><i class="material-icons-round">visibility</i> ${escapeHtml(String(Number(viewCount).toLocaleString('fr-FR')))} vues</span>` : '';

        const mode = this.getAttribute('mode') || 'default';
        const navigateOnCard = this.hasAttribute('navigate-on-card');
        const hideViewBtn = navigateOnCard && (mode === 'default' || mode === 'owner');
        const isPast = this.hasAttribute('is-past');

        const hasActiveBoost = this.hasAttribute('has-active-boost');
        const isBoosted = this.hasAttribute('is-boosted');

        const sponsoredBadgeHtml = isBoosted ? `<span class="sponsored-badge"><i class="material-icons-round">campaign</i> Sponsorisé</span>` : '';

        // Badge de cycle de vie (CAT-04) : Annulée / Réalisée / Expirée / etc.
        // À défaut, une envie publiée mais déjà passée est signalée comme telle.
        const statusInfo = getDesireStatusBadge(this.getAttribute('desire-status'))
            || (isPast ? { label: 'Passée', icon: 'history', tone: 'past' } : null);
        const statusBadgeHtml = statusInfo
            ? `<span class="desire-status-badge status-${statusInfo.tone}"><i class="material-icons-round">${statusInfo.icon}</i> ${statusInfo.label}</span>`
            : '';

        // Demande de maintien (ORG-08/09) : proposé à l'organisateur dont
        // l'activité approche dans les envies créées de son profil.
        const needsMaintenance = mode === 'profile' && this.hasAttribute('needs-maintenance');
        const maintenanceHtml = needsMaintenance ? `
            <div class="maintenance-strip">
                <div class="maintenance-head"><i class="material-icons-round">event_available</i><span>Ton activité approche</span></div>
                <p>Confirme qu'elle est maintenue afin de prévenir les participants.</p>
                <div class="maintenance-actions">
                    <button class="maint-keep-btn" type="button"><i class="material-icons-round">check</i> Maintenir</button>
                    <button class="maint-edit-btn" type="button"><i class="material-icons-round">edit</i> Modifier</button>
                    <button class="maint-cancel-btn" type="button"><i class="material-icons-round">event_busy</i> Annuler</button>
                </div>
            </div>` : '';

        let cardActionsHtml = '';
        if (mode === 'profile') {
            // Mode créateur dans le profil — icônes compactes + boost
            let boostBtnHtml = '';
            if (this.hasAttribute('show-boost')) {
                if (hasActiveBoost) {
                    boostBtnHtml = `<button class="boost-active-btn ca-btn ca-btn--boost" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-color:transparent;">
                        <i class="material-icons-round">rocket_launch</i> Boost en cours
                    </button>`;
                } else {
                    boostBtnHtml = `<button class="boost-inline-btn ca-btn ca-btn--boost"><i class="material-icons-round">rocket_launch</i> Booster</button>`;
                }
            }
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--icon" title="Voir"><i class="material-icons-round">visibility</i></button>
                <button class="edit-btn ca-btn ca-btn--edit" title="Éditer"><i class="material-icons-round">edit</i></button>
                ${boostBtnHtml}
            `;
        } else if (mode === 'owner') {
            if (!hideViewBtn) {
                cardActionsHtml = `
                    <button class="view-btn ca-btn ca-btn--view">
                        <i class="material-icons-round">visibility</i> Voir
                    </button>
                `;
            }
        } else if (mode === 'pending') {
            // Demande déjà envoyée — ouvre les détails au clic
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--pending" style="background:rgba(245, 158, 11, 0.1);color:#d97706;border-color:transparent;">
                    <i class="material-icons-round">hourglass_top</i> Demande en cours
                </button>
            `;
        } else if (mode === 'joined') {
            // Envie rejointe — Déjà rejoint
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--accepted" style="background:var(--success-bg);color:var(--success);border-color:transparent;">
                    <i class="material-icons-round">verified</i> Déjà rejoint
                </button>
            `;
        } else if (mode === 'full') {
            // Envie complète — plus de places
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--full" style="background:rgba(239, 68, 68, 0.1);color:#ef4444;border-color:transparent;">
                    <i class="material-icons-round">block</i> Complet
                </button>
            `;
        } else if (mode === 'past') {
            // Activité déjà passée : la carte reste consultable mais
            // l'inscription est close (CTA désactivé).
            cardActionsHtml = `
                <button class="ca-btn ca-btn--past" type="button" disabled>
                    <i class="material-icons-round">event_busy</i> Activité passée
                </button>
            `;
        } else {
            // CTA principal du catalogue : « Rejoindre » ouvre le détail,
            // où l'inscription est finalisée.
            cardActionsHtml = `
                <button class="join-btn ca-btn ca-btn--join">
                    <i class="material-icons-round">add_circle</i> ${btnText}
                </button>
            `;
            if (this.hasAttribute('show-boost')) {
                cardActionsHtml += '<button class="boost-inline-btn ca-btn ca-btn--boost"><i class="material-icons-round">rocket_launch</i> Booster</button>';
            }
        }

        const themeSafe = ['explore', 'sport', 'chill', 'learn', 'rencontres'].includes(theme) ? theme : 'explore';
        const cardClickableClass = navigateOnCard ? ' desire-card--clickable' : '';
        const actionsStyle = cardActionsHtml ? 'display: flex; gap: 8px;' : 'display: none;';
        this.innerHTML = `
            <article class="desire-card card-${themeSafe}${cardClickableClass}">
                ${imageHtml}
                ${sponsoredBadgeHtml}
                ${statusBadgeHtml}
                <div class="card-header">
                    <div class="user-info">
                        <img src="${avatar || DEFAULT_AVATAR_PATH}" alt="${author}" class="user-avatar" data-fallback-avatar="${avatarFallback}" onerror="this.onerror=null;this.src=this.getAttribute('data-fallback-avatar')">
                        <div class="user-details">
                            <h3>${author}</h3><span>${timeAgo}</span>
                        </div>
                    </div>
                    <div class="theme-icon"><i class="material-icons-round">${escapeHtml(icon)}</i></div>
                </div>
                <div class="card-body">
                    <h2>${title}</h2>
                    <div class="card-meta">
                        <span class="meta-tag"><i class="material-icons-round">location_on</i> ${commune}</span>
                        <span class="meta-tag"><i class="material-icons-round">${dateIcon}</i> ${date}</span>
                        <span class="meta-tag"><i class="material-icons-round">${priceIcon}</i> ${price}</span>
                        ${viewCountHtml}
                    </div>
                </div>
                ${maintenanceHtml}
                <div class="card-footer">
                    <div class="participants">
                        ${avatarsStackHtml}
                        ${spotsHtml}
                    </div>
                    <div class="card-actions" style="${actionsStyle}">
                        ${cardActionsHtml}
                    </div>
                </div>
            </article>
        `;

        const joinBtn = this.querySelector('.join-btn');
        if (joinBtn) {
            const newBtn = joinBtn.cloneNode(true);
            joinBtn.parentNode.replaceChild(newBtn, joinBtn);
            newBtn.addEventListener('click', () => {
                // Utiliser getAttribute() pour récupérer les valeurs brutes (non HTML-échappées),
                // car les consommateurs de l'événement utilisent .textContent (pas innerHTML).
                const event = new CustomEvent('desire-joined', {
                    detail: {
                        id:          this.getAttribute('desire-id'),
                        title:       this.getAttribute('title')    || '',
                        author:      this.getAttribute('author')   || '',
                        theme:       this.getAttribute('theme')    || 'explore',
                        timeAgo:     this.getAttribute('time-ago') || '',
                        commune:     this.getAttribute('commune')  || '',
                        date:        this.getAttribute('date')     || '',
                        spots:       this.getAttribute('spots')    || '',
                        price:       this.getAttribute('price')    || '',
                        avatar:      this.getAttribute('avatar')   || DEFAULT_AVATAR_PATH,
                        images:      imagesArray,
                        description: this.getAttribute('description') || '',
                    },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);
            });
        }

        const boostBtn = this.querySelector('.boost-inline-btn');
        if (boostBtn) {
            boostBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('navigate-boost', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        desireId: this.getAttribute('desire-id'),
                        desireTitle: this.getAttribute('title') || '',
                    }
                }));
            });
        }

        const activeBoostBtn = this.querySelector('.boost-active-btn');
        if (activeBoostBtn) {
            activeBoostBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('view-boost-details', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        desireId:    this.getAttribute('desire-id'),
                        desireTitle: this.getAttribute('title') || '',
                    }
                }));
            });
        }

        const viewBtn = this.querySelector('.view-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._dispatchDesireView(imagesArray);
            });
        }

        if (navigateOnCard) {
            const article = this.querySelector('.desire-card');
            if (article) {
                article.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    this._dispatchDesireView(imagesArray);
                });
            }
        }

        const leaveBtn = this.querySelector('.leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const { showConfirm } = await import('../../utils/confirm.js');
                const ok = await showConfirm({
                    title: 'Quitter cette envie ?',
                    message: 'Vous serez retiré de la liste des participants. Cette action est réversible.',
                    confirmLabel: 'Oui, quitter',
                    cancelLabel: 'Annuler',
                    type: 'danger',
                });
                if (!ok) return;

                const id = this.getAttribute('desire-id');
                leaveBtn.disabled = true;
                leaveBtn.innerHTML = '<i class="material-icons-round" style="font-size: 18px; animation: spin 1s linear infinite;">autorenew</i>';
                try {
                    const { api } = await import('../../api.js');
                    await api.leaveDesire(id);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vous avez quitté cette envie.', type: 'info' } }));
                    // Notifier la page profil de recharger les compteurs et les listes
                    window.dispatchEvent(new CustomEvent('profile-refresh'));
                    // Réinitialiser le mode de la carte (la carte reste visible, bouton passe à "Rejoindre")
                    this.removeAttribute('mode');
                    window.dispatchEvent(new CustomEvent('desire-left', {
                        bubbles: true,
                        composed: true,
                        detail: { desireId: id }
                    }));
                } catch (err) {
                    leaveBtn.disabled = false;
                    leaveBtn.innerHTML = '<i class="material-icons-round" style="font-size: 18px;">logout</i> Quitter';
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Erreur', type: 'error' } }));
                }
            });
        }

        const editBtn = this.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const event = new CustomEvent('navigate-create', {
                    detail: { editMode: true, desireId: this.getAttribute('desire-id') },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);
            });
        }

        // ── Demande de maintien (ORG-08/09) ──────────────────────
        const keepBtn = this.querySelector('.maint-keep-btn');
        if (keepBtn) {
            keepBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = this.getAttribute('desire-id');
                keepBtn.disabled = true;
                try {
                    const { api } = await import('../../api.js');
                    await api.keepDesire(id);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Activité maintenue. Les participants sont prévenus.', type: 'success' } }));
                    window.dispatchEvent(new CustomEvent('profile-refresh'));
                } catch (err) {
                    keepBtn.disabled = false;
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Erreur', type: 'error' } }));
                }
            });
        }

        const maintEditBtn = this.querySelector('.maint-edit-btn');
        if (maintEditBtn) {
            maintEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('navigate-create', {
                    detail: { editMode: true, desireId: this.getAttribute('desire-id') },
                    bubbles: true,
                    composed: true
                }));
            });
        }

        const maintCancelBtn = this.querySelector('.maint-cancel-btn');
        if (maintCancelBtn) {
            maintCancelBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const { showConfirm } = await import('../../utils/confirm.js');
                const ok = await showConfirm({
                    title: 'Annuler cette envie ?',
                    message: 'Les participants seront prévenus que l\'activité est annulée.',
                    confirmLabel: 'Oui, annuler',
                    cancelLabel: 'Retour',
                    type: 'danger',
                });
                if (!ok) return;

                const id = this.getAttribute('desire-id');
                maintCancelBtn.disabled = true;
                try {
                    const { api } = await import('../../api.js');
                    await api.updateDesire(id, { status: 'cancelled' });
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Activité annulée. Les participants sont prévenus.', type: 'info' } }));
                    window.dispatchEvent(new CustomEvent('profile-refresh'));
                } catch (err) {
                    maintCancelBtn.disabled = false;
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Erreur', type: 'error' } }));
                }
            });
        }

        // Masquer le bouton boost si la feature est désactivée (check non-bloquant)
        this._applyBoostVisibility();
    }

    _dispatchDesireView(imagesArray) {
        const currentMode = this.getAttribute('mode');
        const event = new CustomEvent('desire-view', {
            detail: {
                id:          this.getAttribute('desire-id'),
                authorId:    this.dataset.authorId || null,
                isJoined:    currentMode === 'joined' || currentMode === 'pending',
                isPast:      this.hasAttribute('is-past'),
                title:       this.getAttribute('title')    || '',
                author:      this.getAttribute('author')   || '',
                theme:       this.getAttribute('theme')    || 'explore',
                timeAgo:     this.getAttribute('time-ago') || '',
                commune:     this.getAttribute('commune')  || '',
                address:     this.getAttribute('address')  || '',
                date:        this.getAttribute('date')     || '',
                spots:       this.getAttribute('spots')    || '',
                price:       this.getAttribute('price')    || '',
                avatar:      this.getAttribute('avatar')   || DEFAULT_AVATAR_PATH,
                images:      imagesArray,
                description: this.getAttribute('description') || '',
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    async _applyBoostVisibility() {
        try {
            const { syncIsEnabled, isFeatureEnabled } = await import('../../utils/featureFlags.js');
            const cached = syncIsEnabled('boost_activate');
            const enabled = cached !== undefined ? cached : await isFeatureEnabled('boost_activate');
            if (!enabled) {
                const btn = this.querySelector('.boost-inline-btn');
                if (btn) btn.style.display = 'none';
            }
        } catch { /* fail-open */ }
    }
}

customElements.define('desire-card', DesireCard);
