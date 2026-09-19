import { shouldShowCreateHint, dismissCreateHint } from '../../utils/createHint.js';

export class Navbar extends HTMLElement {
    connectedCallback() {
        this._focusDebounce = null;
        this._createHintTimer = null;
        this._createHintAutoHide = null;
        this._createHintShown = false;
        this._onVisibilityChange = () => {
            if (!document.hidden) this.refreshBadge();
        };
        this._onWindowFocus = () => {
            if (this._focusDebounce) clearTimeout(this._focusDebounce);
            this._focusDebounce = setTimeout(() => this.refreshBadge(), 200);
        };

        this.innerHTML = `
            <style>
                .notif-badge {
                    position: absolute; top: 2px; right: 2px;
                    background: #ef4444; color: white;
                    font-size: 10px; font-weight: 700;
                    min-width: 16px; height: 16px;
                    border-radius: 100px; padding: 0 4px;
                    display: flex; align-items: center; justify-content: center;
                    line-height: 1; box-shadow: 0 1px 4px rgba(239,68,68,0.4);
                    pointer-events: none;
                }
            </style>
            <nav class="floating-nav" id="floatingNav">
                <button class="nav-btn active" title="Accueil" aria-label="Retour à l'accueil"><i
                        class="material-icons-round">home</i></button>
                <button class="nav-btn" title="Ajouter" aria-label="Créer une nouvelle envie"><i
                        class="material-icons-round">add_circle_outline</i>
                    <span class="create-hint" id="createHint" aria-hidden="true">Crée une envie</span>
                </button>
                <button class="nav-btn" title="Notifications" aria-label="Vos notifications" style="position: relative;"><i
                        class="material-icons-round">notifications_none</i>
                    <span class="notif-badge" id="notifBadge" style="display: none;">0</span>
                </button>
                <button class="nav-btn profile-btn" title="Profil" aria-label="Mon profil"><i
                        class="material-icons-round">person_outline</i></button>
            </nav>
        `;

        this.setupEventListeners();

        // Accroche de création (pulsation + bulle), une seule fois
        this._maybeShowCreateHint();

        // Plusieurs passes : token / API parfois prêts après le 1er tick (évite badge absent sans F5)
        this._scheduleBadgeRetries([0, 350, 900, 2000, 4000]);

        // Polling régulier pour voir les nouvelles notifs sans recharger la page
        this._badgeInterval = setInterval(() => this.refreshBadge(), 25_000);

        document.addEventListener('visibilitychange', this._onVisibilityChange);
        window.addEventListener('focus', this._onWindowFocus);
    }

    disconnectedCallback() {
        if (this._badgeInterval) clearInterval(this._badgeInterval);
        if (this._focusDebounce) clearTimeout(this._focusDebounce);
        if (this._createHintTimer) clearTimeout(this._createHintTimer);
        if (this._createHintAutoHide) clearTimeout(this._createHintAutoHide);
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('focus', this._onWindowFocus);
    }

    /** Accroche de création : pulsation + bulle, montrée une seule fois. */
    _maybeShowCreateHint() {
        if (!shouldShowCreateHint()) return;
        // Laisser l'arrivée se poser avant d'attirer l'œil sur le bouton.
        this._createHintTimer = setTimeout(() => this._showCreateHint(), 1400);
    }

    _showCreateHint() {
        // Hors accueil la navbar est masquée (display: none) : on n'affiche rien.
        if (!this.isConnected || getComputedStyle(this).display === 'none') return;
        const btn = this.querySelector('.nav-btn[title="Ajouter"]');
        const hint = this.querySelector('#createHint');
        if (!btn || !hint) return;

        const reduceMotion = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion) btn.classList.add('hint-pulse');
        hint.classList.add('is-visible');

        this._createHintShown = true;
        this._createHintAutoHide = setTimeout(() => this._hideCreateHint(), 6000);
    }

    /** Referme l'accroche et la mémorise comme vue (jamais revue ensuite). */
    _hideCreateHint() {
        if (!this._createHintShown) return; // jamais affichée : ne rien mémoriser
        this._createHintShown = false;
        if (this._createHintAutoHide) {
            clearTimeout(this._createHintAutoHide);
            this._createHintAutoHide = null;
        }
        const btn = this.querySelector('.nav-btn[title="Ajouter"]');
        const hint = this.querySelector('#createHint');
        if (btn) btn.classList.remove('hint-pulse');
        if (hint) hint.classList.remove('is-visible');
        dismissCreateHint();
    }

    /** Rafraîchit le badge à plusieurs intervalles (ex. après login ou au chargement). */
    _scheduleBadgeRetries(delaysMs) {
        delaysMs.forEach((ms) => setTimeout(() => this.refreshBadge(), ms));
    }

    setupEventListeners() {
        const buttons = {
            'Accueil': 'navigate-home',
            'Notifications': 'navigate-notifications',
            'Ajouter': 'navigate-creation',
            'Profil': 'navigate-profile'
        };

        Object.entries(buttons).forEach(([title, eventName]) => {
            const btn = this.querySelector(`.nav-btn[title="${title}"]`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const event = new CustomEvent(eventName, {
                        bubbles: true,
                        composed: true
                    });
                    this.dispatchEvent(event);

                    // Toute navigation referme l'accroche de création.
                    this._hideCreateHint();

                    this.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }
        });

        // Rafraîchir le badge sur demande explicite (ex: après markAllRead, desire-joined)
        window.addEventListener('refresh-notif-badge', () => this.refreshBadge());

        // Connexion / inscription : immédiat + relances (token déjà en localStorage après api.login)
        window.addEventListener('user-logged-in', () => {
            this.refreshBadge();
            this._scheduleBadgeRetries([400, 1500]);
        });
    }

    /** Met à jour visuellement le badge avec le count donné */
    updateBadge(count) {
        const badge = this.querySelector('#notifBadge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    /** Appelle l'API pour obtenir le nombre de notifications non lues */
    async refreshBadge() {
        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) {
                this.updateBadge(0);
                return;
            }
            const count = await api.getNotificationCount();
            const n = Number(count);
            this.updateBadge(Number.isFinite(n) ? n : 0);
        } catch (_) {
            /* Erreur réseau / 5xx : prochain poll ou visibilitychange rafraîchira */
        }
    }
}

customElements.define('app-navbar', Navbar);
