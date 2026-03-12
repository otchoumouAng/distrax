import { escapeHtml, safeUrl } from '../../utils/escapeHtml.js';

export class DesireCard extends HTMLElement {
    static get observedAttributes() {
        return ['theme', 'title', 'author', 'time-ago', 'avatar', 'date', 'price', 'spots', 'icon', 'btn-text', 'commune', 'image', 'images', 'show-boost', 'mode', 'desire-id', 'description', 'has-active-boost', 'is-boosted'];
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
        const avatarRaw = this.getAttribute('avatar') || '/assets/img/avatar.png';
        const avatar = safeUrl(avatarRaw) || (avatarRaw.startsWith('/') ? avatarRaw : '');
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
        const firstImageUrl = imagesArray.length > 0 ? (safeUrl(imagesArray[0]) || '') : '';

        // Convert attributes into HTML elements (user content already escaped)
        const spotsHtml = spots ? `<span class="spots-left">${spots}</span>` : '';
        const avatarsStackHtml = `
            <div class="avatars-stack">
                <img src="${escapeHtml(avatar || '/assets/img/avatar.png')}" alt="${author}" class="user-avatar">
            </div>
        `;

        let priceIcon = 'payments';
        let dateIcon = 'calendar_today';
        const dateLower = (this.getAttribute('date') || '').toLowerCase();
        if (dateLower.includes('maintenant')) dateIcon = 'flash_on';
        if (dateLower.includes('après-midi') || dateLower.includes('heure')) dateIcon = 'schedule';

        const imageHtml = firstImageUrl ? `<div class="card-image" style="background-image: url('${escapeHtml(firstImageUrl)}');"></div>` : '';

        const mode = this.getAttribute('mode') || 'default';
        const desireId = this.getAttribute('desire-id');

        const hasActiveBoost = this.hasAttribute('has-active-boost');
        const isBoosted = this.hasAttribute('is-boosted');

        const sponsoredBadgeHtml = isBoosted ? `<span class="sponsored-badge"><i class="material-icons-round">campaign</i> Sponsorisé</span>` : '';

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
            // Ma propre envie dans l'exploration
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--view">
                    <i class="material-icons-round">visibility</i> Voir
                </button>
            `;
        } else if (mode === 'pending') {
            // Demande déjà envoyée — ouvre les détails au clic
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--pending">
                    <i class="material-icons-round">hourglass_top</i> Demande en cours
                </button>
            `;
        } else if (mode === 'joined') {
            // Envie rejointe dans le profil — Voir + Annuler
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--view">
                    <i class="material-icons-round">visibility</i> Voir
                </button>
                <button class="leave-btn ca-btn ca-btn--cancel">
                    <i class="material-icons-round">close</i> Annuler
                </button>
            `;
        } else {
            // Mode par défaut (exploration/résultats)
            cardActionsHtml = `
                <button class="view-btn ca-btn ca-btn--view">
                    <i class="material-icons-round">visibility</i> Voir
                </button>
                ${this.hasAttribute('show-boost') ? '<button class="boost-inline-btn ca-btn ca-btn--boost"><i class="material-icons-round">rocket_launch</i> Booster</button>' : ''}
            `;
        }

        const themeSafe = ['explore', 'sport', 'chill', 'learn', 'rencontres'].includes(theme) ? theme : 'explore';
        this.innerHTML = `
            <article class="desire-card card-${themeSafe}">
                ${imageHtml}
                ${sponsoredBadgeHtml}
                <div class="card-header">
                    <div class="user-info">
                        <img src="${avatar}" alt="${author}" class="user-avatar">
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
                    </div>
                </div>
                <div class="card-footer">
                    <div class="participants">
                        ${avatarsStackHtml}
                        ${spotsHtml}
                    </div>
                    <div class="card-actions" style="display: flex; gap: 8px;">
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
                        avatar:      this.getAttribute('avatar')   || '/assets/img/avatar.png',
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
                // Utilise 'desire-view' et non 'desire-joined' pour ne pas déclencher le toast
                // authorId est stocké dans dataset par ExplorationSection / ResultsContent
                // isJoined est déduit du mode actuel de la carte
                const currentMode = this.getAttribute('mode');
                // Utiliser getAttribute() pour récupérer les valeurs brutes (non HTML-échappées)
                const event = new CustomEvent('desire-view', {
                    detail: {
                        id:          this.getAttribute('desire-id'),
                        authorId:    this.dataset.authorId || null,
                        isJoined:    currentMode === 'joined',
                        title:       this.getAttribute('title')    || '',
                        author:      this.getAttribute('author')   || '',
                        theme:       this.getAttribute('theme')    || 'explore',
                        timeAgo:     this.getAttribute('time-ago') || '',
                        commune:     this.getAttribute('commune')  || '',
                        date:        this.getAttribute('date')     || '',
                        spots:       this.getAttribute('spots')    || '',
                        price:       this.getAttribute('price')    || '',
                        avatar:      this.getAttribute('avatar')   || '/assets/img/avatar.png',
                        images:      imagesArray,
                        description: this.getAttribute('description') || '',
                    },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);
            });
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

        // Masquer le bouton boost si la feature est désactivée (check non-bloquant)
        this._applyBoostVisibility();
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
