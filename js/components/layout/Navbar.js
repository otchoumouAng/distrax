export class Navbar extends HTMLElement {
    connectedCallback() {
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
                        class="material-icons-round">add_circle_outline</i></button>
                <button class="nav-btn" title="Notifications" aria-label="Vos notifications" style="position: relative;"><i
                        class="material-icons-round">notifications_none</i>
                    <span class="notif-badge" id="notifBadge" style="display: none;">0</span>
                </button>
                <button class="nav-btn profile-btn" title="Profil" aria-label="Mon profil"><i
                        class="material-icons-round">person_outline</i></button>
            </nav>
        `;

        this.setupEventListeners();

        // 1er refresh : attendre un tout petit peu que l'auth soit établie
        setTimeout(() => this.refreshBadge(), 800);

        // Polling toutes les 60s pour rester synchronisé (si l'app reste ouverte)
        this._badgeInterval = setInterval(() => this.refreshBadge(), 60_000);
    }

    disconnectedCallback() {
        // Nettoyer le polling quand le composant est retiré du DOM
        if (this._badgeInterval) clearInterval(this._badgeInterval);
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

                    this.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }
        });

        // Rafraîchir le badge sur demande explicite (ex: après markAllRead, desire-joined)
        window.addEventListener('refresh-notif-badge', () => this.refreshBadge());

        // Rafraîchir dès que l'utilisateur se connecte
        window.addEventListener('user-logged-in', () => {
            // Petit délai pour que le token soit bien enregistré dans localStorage
            setTimeout(() => this.refreshBadge(), 300);
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
            this.updateBadge(count || 0);
        } catch (_) {
            // Silencieux — pas critique
        }
    }
}

customElements.define('app-navbar', Navbar);
