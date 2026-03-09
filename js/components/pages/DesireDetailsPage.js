import { escapeHtml, safeUrl } from '../../utils/escapeHtml.js';

export class DesireDetailsPage extends HTMLElement {
    constructor() {
        super();
        this.images = [];
        this.currentIndex = 0;
        this._desireId = null;  // ID de l'envie actuellement affichée
        this._isCreator = false; // si l'utilisateur est le créateur
        this._hasJoined = false; // si l'utilisateur a déjà rejoint
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .details-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    z-index: 999; display: none; opacity: 0; transition: opacity 0.3s;
                }
                .details-overlay.active { opacity: 1; }
                .details-page {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    width: 100%; max-width: 600px; margin: 0 auto;
                    background: var(--bg-main); z-index: 1000;
                    overflow-y: auto; overflow-x: hidden;
                    transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: none; flex-direction: column;
                    box-shadow: 0 0 40px rgba(0,0,0,0.1);
                }
                .details-page.active {
                    transform: translateX(0); display: flex;
                }
                .header-transparent {
                    position: absolute; top: 0; left: 0; width: 100%; z-index: 10;
                    padding: 16px; display: flex; justify-content: space-between; align-items: center;
                }
                .icon-btn {
                    width: 44px; height: 44px; border-radius: 50%; border: none;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
                    color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;
                }
                .hero-carousel {
                    width: 100%; height: 220px; position: relative;
                    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
                    scrollbar-width: none; -ms-overflow-style: none;
                    cursor: zoom-in; flex-shrink: 0;
                }
                .hero-carousel::-webkit-scrollbar { display: none; }
                .hero-slide {
                    /* Dimensions strictement fixes — jamais de déformation */
                    flex: 0 0 100%; width: 100%; height: 220px;
                    object-fit: cover; object-position: center;
                    scroll-snap-align: center; background-color: var(--bg-card);
                    flex-shrink: 0; user-select: none; display: block;
                }

                /* ── Lightbox fullscreen ────────────────────────────── */
                .lightbox {
                    display: none; position: fixed; inset: 0;
                    background: rgba(0,0,0,0.95); z-index: 9999;
                    flex-direction: column; align-items: center; justify-content: center;
                }
                .lightbox.active { display: flex; }
                .lightbox-close {
                    position: absolute; top: 16px; right: 16px;
                    background: rgba(255,255,255,0.15); border: none; color: white;
                    width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 20px; backdrop-filter: blur(8px);
                    transition: background 0.2s;
                }
                .lightbox-close:hover { background: rgba(255,255,255,0.25); }
                .lightbox-counter {
                    position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                    color: white; font-size: 14px; font-weight: 600;
                    background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 100px;
                    backdrop-filter: blur(8px);
                }
                .lightbox-track {
                    width: 100%; height: 100%;
                    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
                    scrollbar-width: none; -ms-overflow-style: none;
                }
                .lightbox-track::-webkit-scrollbar { display: none; }
                .lightbox-slide {
                    flex: 0 0 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    scroll-snap-align: center;
                    padding: 60px 16px;
                    box-sizing: border-box;
                }
                .lightbox-slide img {
                    max-width: 100%; max-height: 100%;
                    object-fit: contain; border-radius: 8px;
                    user-select: none; pointer-events: none;
                }
                .lightbox-dots {
                    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
                    display: flex; gap: 6px;
                }
                .lightbox-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: rgba(255,255,255,0.4); transition: all 0.2s;
                }
                .lightbox-dot.active {
                    background: white; width: 18px; border-radius: 3px;
                }
                .thumbnails-container {
                    display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; scrollbar-width: none;
                    flex-shrink: 0; /* ne jamais comprimer ce container */
                    min-height: 84px; /* 60px image + 24px padding */
                    align-items: center;
                }
                .thumbnails-container::-webkit-scrollbar { display: none; }
                .thumbnail {
                    width: 60px; height: 60px; border-radius: 12px; object-fit: cover;
                    opacity: 0.5; cursor: pointer; transition: all 0.2s;
                    border: 2px solid transparent; flex-shrink: 0;
                }
                .thumbnail.active {
                    opacity: 1; border-color: var(--primary);
                }
                
                .details-body {
                    padding: 20px; padding-bottom: 24px;
                    flex: 1; display: flex; flex-direction: column; gap: 20px;
                }
                .details-title { font-size: 24px; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.3; }
                
                .meta-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;}
                .m-tag { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-card); border-radius: 100px; font-size: 13px; font-weight: 600; color: var(--text-muted); border: 1px solid var(--border-light); }
                .m-tag i { font-size: 16px; color: var(--text-main); }
                [data-theme="dark"] .m-tag { background: color-mix(in srgb, var(--text-main) 5%, transparent); }

                .host-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-light); }
                .host-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
                .host-info h4 { margin: 0; font-size: 15px; color: var(--text-main); }
                .host-info p { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
                
                .description-block {
                    color: var(--text-main); line-height: 1.7; font-size: 15px;
                    padding: 16px; background: var(--bg-card);
                    border-radius: 16px; border: 1px solid var(--border-light);
                }

                /* —— Section Intéressés (visible uniquement pour le créateur) —— */
                .participants-section {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                    background: var(--bg-card);
                    border-radius: 16px;
                    border: 1px solid var(--border-light);
                }
                .participants-section.visible { display: flex; }
                .participants-section-title {
                    font-size: 15px; font-weight: 700; color: var(--text-main);
                    display: flex; align-items: center; gap: 8px; margin: 0;
                }
                .participants-section-title i { color: var(--primary); }
                .participants-counters {
                    display: flex; gap: 8px; flex-wrap: wrap;
                }
                .participants-counter-chip {
                    font-size: 12px; font-weight: 600; padding: 3px 10px;
                    border-radius: 100px; display: flex; align-items: center; gap: 4px;
                }
                .participants-list { display: flex; flex-direction: column; gap: 10px; }
                .participant-item {
                    display: flex; align-items: center; gap: 12px;
                    padding: 10px 12px; border-radius: 12px;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                }
                .participant-avatar {
                    width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
                    background: var(--bg-card); flex-shrink: 0;
                }
                .participant-pseudo { font-size: 14px; font-weight: 600; color: var(--text-main); }
                .participants-empty { color: var(--text-muted); font-size: 14px; text-align: center; padding: 12px 0; }

                .details-footer {
                    /* sticky dans le flex-column du panneau scrollable */
                    position: sticky; bottom: 0;
                    width: 100%;
                    padding: 14px 24px; background: var(--glass-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-top: 1px solid var(--border-light); z-index: 100;
                    display: flex; justify-content: space-between; align-items: center; gap: 16px;
                    box-sizing: border-box;
                    min-height: 80px;
                    margin-top: auto;
                }
                .price-info { display: flex; flex-direction: column; }
                .price-val { font-size: 18px; font-weight: 700; color: var(--text-main); }
                .price-sub { font-size: 12px; color: var(--text-muted); }

                .join-action-btn {
                    flex: 1; max-width: 250px;
                    /* Hauteur fixe pour éviter le layout shift quand le texte change */
                    height: 52px; min-height: 52px;
                    padding: 0 20px; border-radius: 100px; border: none;
                    background: linear-gradient(135deg, var(--primary), var(--primary-light));
                    color: white; font-weight: 700; font-size: 15px; cursor: pointer;
                    box-shadow: 0 4px 15px color-mix(in srgb, var(--primary) 30%, transparent);
                    text-align: center; transition: background 0.3s, transform 0.1s;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                .join-action-btn:active { transform: scale(0.97); }
                /* Quitter — même style que le leave-btn des cartes MAIS hauteur 52px maintenue */
                .join-action-btn.joined {
                    background: transparent;
                    border: 1px solid #ef4444;
                    color: #ef4444;
                    box-shadow: none;
                    /* Garder la même height pour éviter le layout shift */
                    font-size: 14px;
                    font-weight: 600;
                    gap: 6px;
                    border-radius: 100px;
                }
                .join-action-btn.creator-badge {
                    background: linear-gradient(135deg, #f59e0b, #f97316);
                    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
                    cursor: default;
                    pointer-events: none;
                }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            </style>
            <div class="details-overlay" id="detailsOverlay"></div>
            <div class="details-page" id="desireDetailsPage">
                <header class="header-transparent">
                    <button class="icon-btn back-btn" aria-label="Retour"><i class="material-icons-round">arrow_back</i></button>
                    <div style="display: flex; gap: 8px;">
                        <button class="icon-btn share-btn" aria-label="Partager"><i class="material-icons-round">share</i></button>
                        <button class="icon-btn save-btn" aria-label="Sauvegarder"><i class="material-icons-round">favorite_border</i></button>
                    </div>
                </header>

                <div class="hero-carousel" id="detailsHeroCarousel"></div>
                <div class="thumbnails-container" id="detailsThumbnails"></div>

                <div class="details-body">
                    <h1 class="details-title" id="dTitle">Atelier de poterie et création artisanale</h1>
                    
                    <div class="meta-tags" id="dMeta">
                        <span class="m-tag"><i class="material-icons-round">location_on</i> <span id="dCommune">Plateau</span></span>
                        <span class="m-tag"><i class="material-icons-round">calendar_today</i> <span id="dDate">Samedi, 14:00</span></span>
                        <span class="m-tag"><i class="material-icons-round">group</i> <span id="dSpots">Reste 5 places</span></span>
                    </div>

                    <div class="host-card">
                        <img src="" id="dAvatar" class="host-avatar" alt="Hôte">
                        <div class="host-info">
                            <h4 id="dAuthor">Alice B.</h4>
                            <p>Organisateur (Il y a <span id="dTime">3 heures</span>)</p>
                        </div>
                    </div>

                    <div class="description-block" id="dDescription">
                        Aucune description fournie.
                    </div>

                    <!-- Section intéressés (créateur uniquement) -->
                    <div class="participants-section" id="participantsSection">
                        <h3 class="participants-section-title">
                            <i class="material-icons-round">favorite_border</i>
                            Intéressés
                            <span id="participantsBadge" style="background: var(--primary); color: white; font-size: 12px; padding: 2px 8px; border-radius: 100px; margin-left: 4px;">0</span>
                        </h3>
                        <!-- Compteurs accepté/refusé -->
                        <div class="participants-counters" id="participantsCounters" style="display:none;">
                            <span class="participants-counter-chip" id="counterAccepted" style="background:#d1fae5; color:#059669;">
                                <i class="material-icons-round" style="font-size:13px;">check_circle</i>
                                <span id="countAccepted">0</span> Accepté(s)
                            </span>
                            <span class="participants-counter-chip" id="counterRejected" style="background:#fee2e2; color:#ef4444;">
                                <i class="material-icons-round" style="font-size:13px;">cancel</i>
                                <span id="countRejected">0</span> Refusé(s)
                            </span>
                        </div>
                        <div class="participants-list" id="participantsList">
                            <p class="participants-empty">Chargement…</p>
                        </div>
                    </div>
                </div>

                <div class="details-footer">
                    <div class="price-info">
                        <span class="price-val" id="dPrice">15 000 FCFA</span>
                        <span class="price-sub">Par personne</span>
                    </div>
                    <button class="join-action-btn" id="joinActionBtn">Rejoindre</button>
                </div>
            </div>
        `;

        this.setupListeners();
    }

    setupListeners() {
        const backBtn = this.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.close());
        }

        const shareBtn = this.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this._handleShare());
        }

        const overlay = this.querySelector('#detailsOverlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.close());
        }

        const carousel = this.querySelector('#detailsHeroCarousel');
        if (carousel) {
            carousel.addEventListener('scroll', () => {
                if (carousel.offsetWidth === 0) return;
                const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
                if (index !== this.currentIndex) {
                    this.currentIndex = index;
                    this.updateThumbnails();
                }
            });
        }

        // ── Bouton Rejoindre / Quitter ─────────────────────────
        const joinBtn = this.querySelector('#joinActionBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', async () => {
                // Si créateur, le bouton est désactivé (CSS pointer-events: none)
                if (this._isCreator) return;

                const { api } = await import('../../api.js');

                if (!api.isAuthenticated()) {
                    joinBtn.textContent = 'Connectez-vous d\'abord';
                    joinBtn.style.background = '#ef4444';
                    setTimeout(() => {
                        joinBtn.textContent = 'Rejoindre';
                        joinBtn.style.background = '';
                        this.close();
                        document.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
                    }, 1500);
                    return;
                }

                const isLeaving = this._hasJoined;

                // Demander confirmation avant de quitter
                if (isLeaving) {
                    const { showConfirm } = await import('../../utils/confirm.js');
                    const ok = await showConfirm({
                        title: 'Quitter cette envie ?',
                        message: 'Vous serez retiré de la liste des participants. Cette action est réversible.',
                        confirmLabel: 'Oui, quitter',
                        cancelLabel: 'Annuler',
                        type: 'danger',
                    });
                    if (!ok) return;
                }

                const originalHTML = joinBtn.innerHTML;
                joinBtn.disabled = true;
                joinBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite; vertical-align: middle;">autorenew</i> En cours...';

                try {
                    if (isLeaving) {
                        // ── Quitter l'envie ──────────────────────────────
                        await api.leaveDesire(this._desireId);
                        this._hasJoined = false;
                        joinBtn.disabled = false;
                        this._updateJoinButton(joinBtn);
                        // Émettre un toast de confirmation
                        window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { message: 'Vous avez quitté cette envie.', type: 'info' }
                        }));
                    } else {
                        // ── Rejoindre l'envie ────────────────────────────
                        await api.joinDesire(this._desireId);
                        this._hasJoined = true;
                        joinBtn.disabled = false;
                        joinBtn.style.background = '#10b981';
                        joinBtn.innerHTML = '<i class="material-icons-round" style="vertical-align: middle;">check</i> Rejoint !';

                        // Émettre un événement de confirmation
                        window.dispatchEvent(new CustomEvent('desire-joined', {
                            detail: { desireId: this._desireId }
                        }));

                        setTimeout(() => {
                            this._updateJoinButton(joinBtn);
                            this.close();
                        }, 1200);
                    }
                } catch (err) {
                    joinBtn.disabled = false;
                    joinBtn.style.background = '#ef4444';
                    joinBtn.textContent = err.message || 'Erreur';
                    setTimeout(() => {
                        joinBtn.style.background = '';
                        joinBtn.innerHTML = originalHTML;
                    }, 2500);
                }
            });
        }
    }

    /** Met à jour visuellement le bouton selon l'état _hasJoined / _isCreator / _isAccepted / _isRejected */
    _updateJoinButton(btn) {
        btn = btn || this.querySelector('#joinActionBtn');
        if (!btn) return;

        btn.classList.remove('joined', 'creator-badge');
        btn.style.background = '';

        // Masquer la carte organisateur et le footer CTA si c'est le créateur
        const hostCard = this.querySelector('.host-card');
        if (hostCard) hostCard.style.display = this._isCreator ? 'none' : '';
        const footer = this.querySelector('.details-footer');

        if (this._isCreator) {
            if (footer) footer.style.display = 'none';
        } else if (this._isRejected) {
            // Refusé : masquer le footer, l'envie sera retirée de la liste
            if (footer) footer.style.display = 'none';
            // Retirer les cartes joined correspondantes dans le profil et l'exploration
            window.dispatchEvent(new CustomEvent('desire-rejected', { detail: { desireId: this._desireId } }));
        } else if (this._isAccepted) {
            // Accepté : afficher info non-cliquable
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.cursor = 'default';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">verified</i> Participation confirmée';
        } else if (this._hasJoined) {
            if (footer) footer.style.display = '';
            btn.classList.add('joined');
            btn.innerHTML = '<i class="material-icons-round" style="font-size: 18px;">logout</i> Quitter';
        } else {
            if (footer) footer.style.display = '';
            btn.innerHTML = 'Rejoindre';
        }
    }

    _formatDateDetail(iso) {
        if (!iso) return 'Date à confirmer';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    _formatPriceDetail(desire) {
        if (desire.price_type === 'free') return 'Gratuit';
        if (desire.price_type === 'contribution') return 'Contribution libre';
        const amount = desire.price_amount;
        return amount ? `${Number(amount).toLocaleString('fr-FR')} FCFA` : 'Payant';
    }

    async open(data) {
        // Normaliser l'ID — rejeter null / 'null' / undefined / vide
        const rawId = data.id || data.desireId || data.desire_id || null;
        this._desireId = (rawId && rawId !== 'null' && rawId !== 'undefined') ? rawId : null;
        if (!this._desireId) {
            console.warn('[DesireDetails] ID manquant dans le payload desire-view :', data);
        }
        this._isCreator = false;
        this._hasJoined = false;
        this._isRejected = false;
        this._isAccepted = false;

        // Si on n'a que l'id (ex: après création, ou clic notif), charger les détails
        if (this._desireId && !data.title) {
            try {
                const { api } = await import('../../api.js');
                const full = await api.getDesire(this._desireId);
                const author = full.user?.pseudo ?? full.author_pseudo ?? full.author?.pseudo ?? 'Anonyme';
                const authorId = full.user?.id ?? full.author_id ?? full.author?.id ?? null;
                data = {
                    id: full.id,
                    desireId: full.id,
                    title: full.title,
                    author,
                    authorId,
                    timeAgo: 'À l\'instant',
                    commune: full.commune || 'Abidjan',
                    date: this._formatDateDetail(full.event_date),
                    spots: `${full.spots_taken ?? 0}/${full.max_spots ?? 1} places`,
                    price: this._formatPriceDetail(full),
                    avatar: full.user?.avatar_url ?? full.author_avatar_url ?? full.author?.avatar_url ?? '/assets/img/avatar.png',
                    images: full.images || [],
                    description: full.description || '',
                };
            } catch (err) {
                console.warn('[DesireDetails] Erreur chargement envie par id:', err);
            }
        }

        // Hydrate data
        this.querySelector('#dTitle').textContent = data.title || '';
        this.querySelector('#dAuthor').textContent = data.author || 'Anonyme';
        this.querySelector('#dTime').textContent = data.timeAgo || 'À l\'instant';
        this.querySelector('#dCommune').textContent = data.commune || '';
        this.querySelector('#dDate').textContent = data.date || '';
        this.querySelector('#dSpots').textContent = data.spots || '';
        this.querySelector('#dPrice').textContent = data.price || 'Gratuit';
        this.querySelector('#dAvatar').src = data.avatar || '/assets/img/avatar.png';
        const desc = this.querySelector('#dDescription');
        if (desc) desc.textContent = data.description || 'Aucune description fournie pour cette envie.';

        this.images = data.images || [];
        this.currentIndex = 0;
        this.renderCarousel();

        const overlay = this.querySelector('#detailsOverlay');
        overlay.style.display = 'block';

        const page = this.querySelector('#desireDetailsPage');
        page.style.display = 'flex';

        // Force reflow
        void page.offsetWidth;

        page.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        const navbar = document.querySelector('app-navbar');
        if (navbar) navbar.style.display = 'none';

        // Reset bouton avant le check asynchrone
        const joinBtn = this.querySelector('#joinActionBtn');
        if (joinBtn) {
            joinBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite; vertical-align: middle; font-size: 18px;">autorenew</i>';
            joinBtn.disabled = true;
        }

        // ── Vérification asynchrone de l'état (créateur ? déjà rejoint ?) ──
        await this._checkUserStatus(data);
    }

    /**
     * Vérifie si l'utilisateur est le créateur ou a déjà rejoint l'envie.
     */
    async _checkUserStatus(data) {
        const joinBtn = this.querySelector('#joinActionBtn');
        const participantsSection = this.querySelector('#participantsSection');

        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) {
                // Non connecté : bouton "Rejoindre" simple
                joinBtn.disabled = false;
                this._updateJoinButton(joinBtn);
                return;
            }

            // Récupérer l'utilisateur connecté (via cache localStorage d'abord)
            const cachedUser = JSON.parse(localStorage.getItem('distrax-user') || 'null');
            const me = cachedUser || await api.getMe();

            // Optimisation : si la carte indique déjà que l'utilisateur a rejoint (mode='joined')
            if (data.isJoined === true) {
                this._hasJoined = true;
                participantsSection?.classList.remove('visible');
                if (joinBtn) { joinBtn.disabled = false; this._updateJoinButton(joinBtn); }
                return;
            }

            // Vérifier si créateur (comparaison type-safe string/number)
            if (me && data.authorId && String(me.id) === String(data.authorId)) {
                this._isCreator = true;
            }

            if (this._isCreator) {
                // —— Mode créateur : afficher les intéressés ——
                participantsSection?.classList.add('visible');
                this._loadParticipants(api);
            } else {
                // —— Mode participant : vérifier statut (pending/accepted/rejected) ——
                participantsSection?.classList.remove('visible');
                const joined = await api.getJoinedDesires();
                const match = Array.isArray(joined) && joined.find(d => String(d.id) === String(this._desireId));
                this._hasJoined = !!match;
                // Si le statut est 'rejected', masquer le CTA
                if (match && match.status === 'rejected') {
                    this._hasJoined = false;
                    this._isRejected = true;
                }
                // Si accepté, bloquer le bouton Quitter
                if (match && match.status === 'accepted') {
                    this._isAccepted = true;
                }
            }
        } catch (err) {
            console.warn('[DesireDetails] Erreur lors du check statut :', err.message);
        } finally {
            if (joinBtn) {
                joinBtn.disabled = false;
                this._updateJoinButton(joinBtn);
            }
        }
    }

    /**
     * Charge la liste des participants (visible uniquement pour le créateur).
     */
    async _loadParticipants(api) {
        const list = this.querySelector('#participantsList');
        const badge = this.querySelector('#participantsBadge');
        if (!list) return;

        try {
            const raw = await api.getDesireParticipants(this._desireId);
            if (!list) return; // page fermée entre-temps

            // Normaliser la réponse : tableau direct ou objet wrappé
            const participants = Array.isArray(raw)
                ? raw
                : (raw?.participants || raw?.items || raw?.data || []);

            if (!participants || participants.length === 0) {
                list.innerHTML = `<p class="participants-empty">Aucun intérêssé pour l'instant.</p>`;
                if (badge) badge.textContent = '0';
                return;
            }

            if (badge) badge.textContent = participants.length;

            // Compteurs accepté/refusé
            const accepted = participants.filter(p => p.status === 'accepted').length;
            const rejected = participants.filter(p => p.status === 'rejected').length;
            const countersEl = this.querySelector('#participantsCounters');
            if (countersEl && (accepted > 0 || rejected > 0)) {
                countersEl.style.display = 'flex';
                const countAcc = this.querySelector('#countAccepted');
                const countRej = this.querySelector('#countRejected');
                if (countAcc) countAcc.textContent = accepted;
                if (countRej) countRej.textContent = rejected;
            }

            // Styles des statuts
            const statusStyles = {
                accepted: { bg: '#d1fae5', color: '#059669', label: 'Accepté' },
                rejected: { bg: '#fee2e2', color: '#ef4444', label: 'Refusé' },
                pending: { bg: '#fef3c7', color: '#d97706', label: 'En attente' },
            };

            list.innerHTML = participants.map(p => {
                const st = statusStyles[p.status] || statusStyles.pending;
                const isPending = !p.status || p.status === 'pending';
                const pseudoSafe = escapeHtml(p.pseudo || 'Utilisateur');
                const avatarSrc = safeUrl(p.avatar_url || p.avatar) || (p.avatar_url && p.avatar_url.startsWith('/') ? p.avatar_url : '') || '/assets/img/avatar.png';
                const phoneDisplay = escapeHtml(p.phone || '');
                const phoneDigits = p.phone ? String(p.phone).replace(/\D/g, '') : '';
                const userIdSafe = escapeHtml(String(p.user_id));
                return `
                <div class="participant-item" data-user-id="${userIdSafe}" style="display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:12px; background:var(--bg-main); border:1px solid ${p.status === 'accepted' ? '#10b981' : 'var(--border-light)'};">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img 
                            src="${escapeHtml(avatarSrc)}"
                            alt="${pseudoSafe}"
                            class="participant-avatar"
                            onerror="this.src='/assets/img/avatar.png'"
                        >
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:14px; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${pseudoSafe}
                            </div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                                ${p.joined_at ? new Date(p.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                        <span style="font-size:11px; font-weight:600; padding:3px 8px; border-radius:100px; background:${st.bg}; color:${st.color}; white-space:nowrap; flex-shrink:0;">
                            ${st.label}
                        </span>
                        ${isPending ? `
                        <div class="participant-actions" style="display:flex; gap:6px; flex-shrink:0;">
                            <button class="accept-btn" data-user-id="${userIdSafe}" title="Accepter"
                                style="width:36px; height:36px; border-radius:50%; border:none; background:#d1fae5; color:#059669; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                                <i class="material-icons-round" style="font-size:18px;">check_circle</i>
                            </button>
                            <button class="reject-btn" data-user-id="${userIdSafe}" title="Refuser"
                                style="width:36px; height:36px; border-radius:50%; border:none; background:#fee2e2; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                                <i class="material-icons-round" style="font-size:18px;">cancel</i>
                            </button>
                        </div>` : ''}
                    </div>
                    ${p.status === 'accepted' && phoneDigits ? `
                    <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:color-mix(in srgb,#10b981 8%,transparent); border-radius:10px; border:1px solid color-mix(in srgb,#10b981 25%,transparent);">
                        <i class="material-icons-round" style="font-size:18px; color:#059669; flex-shrink:0;">phone</i>
                        <span style="font-size:13px; font-weight:600; color:var(--text-main); flex:1; letter-spacing:0.5px;">${phoneDisplay}</span>
                        <a href="tel:${escapeHtml(phoneDigits)}" title="Appeler"
                            style="width:34px; height:34px; border-radius:50%; background:#059669; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0; transition:opacity 0.2s;">
                            <i class="material-icons-round" style="font-size:17px;">call</i>
                        </a>
                        <a href="https://wa.me/${escapeHtml(phoneDigits)}" target="_blank" rel="noopener" title="WhatsApp"
                            style="width:34px; height:34px; border-radius:50%; background:#25d366; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0; transition:opacity 0.2s;">
                            <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white;" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                        </a>
                    </div>` : ''}
                </div>`;
            }).join('');

            // Câbler les boutons accept/reject
            list.querySelectorAll('.accept-btn').forEach(btn => {
                btn.addEventListener('click', () => this._handleParticipantAction('accept', btn.dataset.userId, api));
            });
            list.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => this._handleParticipantAction('reject', btn.dataset.userId, api));
            });

        } catch (err) {
            if (list) list.innerHTML = `<p class="participants-empty">Impossible de charger les participants.</p>`;
            console.warn('[DesireDetails] Participants non chargés :', err.message);
        }
    }

    /** Accepter ou refuser un participant, avec retour visuel */
    async _handleParticipantAction(action, userId, api) {
        const item = this.querySelector(`.participant-item[data-user-id="${userId}"]`);
        if (!item) return;

        const actions = item.querySelector('.participant-actions');
        if (actions) {
            actions.innerHTML = `<i class="material-icons-round" style="font-size:18px; animation: spin 1s linear infinite; color:var(--text-muted);">autorenew</i>`;
        }

        try {
            if (action === 'accept') {
                await api.acceptParticipant(this._desireId, userId);
            } else {
                await api.rejectParticipant(this._desireId, userId);
            }
            // Recharger la liste
            await this._loadParticipants(api);
        } catch (err) {
            if (actions) actions.innerHTML = `<span style="font-size:12px; color:#ef4444;">Erreur</span>`;
            console.warn('[DesireDetails] Action participant échouée:', err.message);
        }
    }

    /** Indique si l'overlay de détail est actuellement affiché (pour le bouton retour device). */
    isOpen() {
        const overlay = this.querySelector('#detailsOverlay');
        return overlay && overlay.classList.contains('active') && overlay.style.display !== 'none';
    }

    close() {
        const page = this.querySelector('#desireDetailsPage');
        const overlay = this.querySelector('#detailsOverlay');
        const participantsSection = this.querySelector('#participantsSection');

        page.classList.remove('active');
        overlay.classList.remove('active');
        if (participantsSection) participantsSection.classList.remove('visible');

        setTimeout(() => {
            page.style.display = 'none';
            overlay.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';

        // Laisser le routeur gérer la navbar selon la page courante (home = visible, profil/notifs = cachée)
        window.dispatchEvent(new CustomEvent('desire-detail-closed', { bubbles: true, composed: true }));
    }

    /** Partager l'envie : Web Share API (natif) ou share bottom-sheet (fallback). */
    _handleShare() {
        if (!this._desireId) return;
        const titleEl = this.querySelector('#dTitle');
        const title = (titleEl && titleEl.textContent) ? titleEl.textContent.trim() : 'Une envie sur Distrax';
        const url   = `${window.location.origin}${window.location.pathname || '/'}#desire/${this._desireId}`;
        const text  = `${title} — Découvre cette envie sur Distrax`;

        // Web Share API — ouvre le menu natif du système (WhatsApp, Instagram, TikTok, etc.)
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            navigator.share({ title: 'Distrax', text, url })
                .then(() => {
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Partage réussi', type: 'success' } }));
                })
                .catch((err) => {
                    if (err.name === 'AbortError') return; // utilisateur a annulé
                    // Partage natif échoué (ex. HTTP en dev) → bottom-sheet
                    this._showShareSheet(url, text);
                });
            return;
        }
        // Fallback : bottom-sheet custom (desktop, navigateurs sans support)
        this._showShareSheet(url, text);
    }

    /**
     * Affiche une bottom-sheet avec des options de partage direct :
     * WhatsApp, Facebook, Telegram, Twitter/X, Copier le lien.
     */
    _showShareSheet(url, text) {
        const existing = document.getElementById('_distraxShareSheet');
        if (existing) existing.remove();

        const encodedUrl  = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);

        const platforms = [
            {
                key:   'whatsapp',
                label: 'WhatsApp',
                color: '#25d366',
                href:  `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>`,
            },
            {
                key:   'facebook',
                label: 'Facebook',
                color: '#1877f2',
                href:  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>`,
            },
            {
                key:   'telegram',
                label: 'Telegram',
                color: '#0088cc',
                href:  `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>`,
            },
            {
                key:   'twitter',
                label: 'Twitter / X',
                color: '#000000',
                href:  `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>`,
            },
        ];

        const sheet = document.createElement('div');
        sheet.id = '_distraxShareSheet';
        sheet.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,.5); backdrop-filter:blur(4px);
            display:flex; align-items:flex-end; justify-content:center;
            animation:ssOverlayIn .2s ease;
        `;
        sheet.innerHTML = `
            <style>
                @keyframes ssOverlayIn { from { opacity:0 } to { opacity:1 } }
                @keyframes ssSlideUp   { from { transform:translateY(100%) } to { transform:translateY(0) } }
                .ss-btn { display:flex; flex-direction:column; align-items:center; gap:8px;
                          background:none; border:none; cursor:pointer; padding:10px 8px;
                          color:var(--text-primary,#111); border-radius:12px;
                          transition:background .15s; min-width:64px; }
                .ss-btn:active { background:var(--bg-secondary,#f3f4f6); }
                .ss-icon { width:52px; height:52px; border-radius:14px; display:flex;
                           align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
                .ss-label { font-size:11px; font-weight:600; color:var(--text-muted,#6b7280); }
                .ss-copy-row { display:flex; align-items:center; gap:12px; width:100%;
                               background:var(--bg-secondary,#f3f4f6); border-radius:12px;
                               padding:12px 14px; box-sizing:border-box; }
            </style>
            <div style="background:var(--bg-primary,#fff); border-radius:24px 24px 0 0; width:100%;
                        max-width:600px; padding:20px 20px 32px;
                        animation:ssSlideUp .25s cubic-bezier(.16,1,.3,1);">
                <!-- Handle -->
                <div style="width:40px; height:4px; background:var(--border-color,#e5e7eb);
                            border-radius:2px; margin:0 auto 20px;"></div>
                <h3 style="font-size:16px; font-weight:700; margin:0 0 20px; color:var(--text-primary,#111);">
                    Partager cette envie
                </h3>
                <!-- Platform buttons -->
                <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:20px;">
                    ${platforms.map(p => `
                        <a href="${p.href}" target="_blank" rel="noopener noreferrer"
                           class="ss-btn" id="ss-${p.key}" style="text-decoration:none;">
                            <div class="ss-icon" style="background:${p.color};">
                                ${p.svg}
                            </div>
                            <span class="ss-label">${p.label}</span>
                        </a>
                    `).join('')}
                </div>
                <!-- Copy link row -->
                <div class="ss-copy-row">
                    <i class="material-icons-round" style="color:var(--primary,#6366f1); flex-shrink:0;">link</i>
                    <span id="ss-url-display" style="font-size:13px; color:var(--text-muted,#6b7280);
                          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                        ${escapeHtml(url)}
                    </span>
                    <button id="ss-copy-btn"
                        style="padding:8px 16px; background:var(--primary,#6366f1); color:#fff;
                               border:none; border-radius:10px; cursor:pointer; font-weight:600;
                               font-size:13px; flex-shrink:0; white-space:nowrap;">
                        Copier
                    </button>
                </div>
                <!-- Cancel -->
                <button id="ss-cancel"
                    style="width:100%; margin-top:14px; padding:13px; background:transparent;
                           color:var(--text-muted,#6b7280); border:none; cursor:pointer;
                           font-size:15px; font-weight:600; border-radius:12px;">
                    Annuler
                </button>
            </div>
        `;

        document.body.appendChild(sheet);

        // Fermer en cliquant sur l'overlay
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) sheet.remove();
        });
        sheet.querySelector('#ss-cancel').addEventListener('click', () => sheet.remove());

        // Copier le lien
        sheet.querySelector('#ss-copy-btn').addEventListener('click', () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(() => {
                    const btn = sheet.querySelector('#ss-copy-btn');
                    btn.textContent = 'Copié !';
                    btn.style.background = '#10b981';
                    setTimeout(() => sheet.remove(), 1200);
                });
            } else {
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Lien copié', type: 'success' } }));
                sheet.remove();
            }
        });

        // Fermer la feuille après clic sur un réseau (ouverture dans nouvel onglet)
        platforms.forEach(p => {
            sheet.querySelector(`#ss-${p.key}`)?.addEventListener('click', () => {
                setTimeout(() => sheet.remove(), 300);
            });
        });
    }

    renderCarousel() {
        const carousel = this.querySelector('#detailsHeroCarousel');
        const thumbsContainer = this.querySelector('#detailsThumbnails');

        carousel.innerHTML = '';
        thumbsContainer.innerHTML = '';

        if (this.images.length === 0) {
            thumbsContainer.style.display = 'none';
            // Placeholder si aucune image
            carousel.style.background = 'var(--bg-card)';
            return;
        }

        thumbsContainer.style.display = this.images.length > 1 ? 'flex' : 'none';

        this.images.forEach((img, i) => {
            const slide = document.createElement('img');
            slide.src = img;
            slide.className = 'hero-slide';
            slide.alt = `Image ${i + 1}`;
            // Clic → ouvre le lightbox à cet index
            slide.addEventListener('click', () => this.openLightbox(i));
            carousel.appendChild(slide);

            if (this.images.length > 1) {
                const thumb = document.createElement('img');
                thumb.src = img;
                thumb.className = `thumbnail ${i === 0 ? 'active' : ''}`;
                thumb.alt = `Miniature ${i + 1}`;
                thumb.addEventListener('click', () => {
                    const targetScroll = carousel.offsetWidth * i;
                    carousel.scrollTo({ left: targetScroll, behavior: 'smooth' });
                    this.currentIndex = i;
                    this.updateThumbnails();
                });
                thumbsContainer.appendChild(thumb);
            }
        });

        carousel.scrollLeft = 0;
    }

    /** Ouvre le lightbox fullscreen à l'index donné */
    openLightbox(startIndex = 0) {
        if (!this.images || this.images.length === 0) return;

        // Construire le lightbox
        let lb = this.querySelector('#detailsLightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'detailsLightbox';
            lb.className = 'lightbox';
            lb.innerHTML = `
                <button class="lightbox-close" id="lbClose" aria-label="Fermer">
                    <i class="material-icons-round">close</i>
                </button>
                <div class="lightbox-counter" id="lbCounter">1 / 1</div>
                <div class="lightbox-track" id="lbTrack"></div>
                <div class="lightbox-dots" id="lbDots"></div>
            `;
            this.appendChild(lb);

            // Fermer au clic sur le fond (pas sur l'image)
            lb.addEventListener('click', (e) => {
                if (e.target === lb || e.target.classList.contains('lightbox-slide')) {
                    lb.classList.remove('active');
                    document.body.style.overflow = 'hidden'; // garder le détails scrollé
                }
            });
            lb.querySelector('#lbClose').addEventListener('click', () => {
                lb.classList.remove('active');
            });
        }

        // Remplir le track
        const track = lb.querySelector('#lbTrack');
        const counter = lb.querySelector('#lbCounter');
        const dotsContainer = lb.querySelector('#lbDots');
        track.innerHTML = '';
        dotsContainer.innerHTML = '';

        this.images.forEach((src, i) => {
            const slide = document.createElement('div');
            slide.className = 'lightbox-slide';
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Image ${i + 1}`;
            slide.appendChild(img);
            track.appendChild(slide);

            const dot = document.createElement('div');
            dot.className = `lightbox-dot${i === startIndex ? ' active' : ''}`;
            dotsContainer.appendChild(dot);
        });

        // Aller à l'index de départ
        const updateLightboxUI = (idx) => {
            counter.textContent = `${idx + 1} / ${this.images.length}`;
            dotsContainer.querySelectorAll('.lightbox-dot').forEach((d, i) => {
                d.classList.toggle('active', i === idx);
            });
        };

        // Mettre à jour le compteur au scroll
        track.addEventListener('scroll', () => {
            if (track.offsetWidth === 0) return;
            const idx = Math.round(track.scrollLeft / track.offsetWidth);
            updateLightboxUI(idx);
        });

        lb.classList.add('active');

        // Scroller vers l'index sans animation (instantané)
        requestAnimationFrame(() => {
            track.scrollLeft = track.offsetWidth * startIndex;
            updateLightboxUI(startIndex);
        });
    }

    updateThumbnails() {
        const thumbs = this.querySelectorAll('.thumbnail');
        thumbs.forEach((thumb, i) => {
            if (i === this.currentIndex) thumb.classList.add('active');
            else thumb.classList.remove('active');

            if (i === this.currentIndex) {
                const container = this.querySelector('#detailsThumbnails');
                const scrollLeft = thumb.offsetLeft - (container.offsetWidth / 2) + (thumb.offsetWidth / 2);
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        });
    }
}

customElements.define('app-desire-details', DesireDetailsPage);
