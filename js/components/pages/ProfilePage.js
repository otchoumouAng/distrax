import { escapeHtml, safeUrl, DEFAULT_AVATAR_PATH, DEFAULT_AVATAR_DATA_URI } from '../../utils/escapeHtml.js';
import { resolveImageUrl } from '../../utils/imageUrl.js';
import { formatSpotsLabel } from '../../utils/formatSpots.js';

export class ProfilePage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="page-section profile-page" id="profilePage" style="display: none; height: 100svh; overflow-y: auto; overflow-x: hidden;">
                
                <!-- Header sticky -->
                <header class="profile-sticky-header">
                    <button class="round-icon-btn back-to-home" title="Retour" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <span class="profile-header-title">Mon Profil</span>
                    <div style="width: 44px;"></div>
                </header>

                <div class="profile-body">

                    <!-- Avatar + Nom -->
                    <div class="profile-hero">
                        <div class="profile-avatar-wrap">
                            <img src="${escapeHtml(DEFAULT_AVATAR_PATH)}" alt="Mon Profil" class="profile-avatar" id="avatarImage" data-fallback-avatar="${escapeHtml(DEFAULT_AVATAR_DATA_URI)}" onerror="this.onerror=null;this.src=this.getAttribute('data-fallback-avatar')">
                            <button class="profile-avatar-edit" id="editAvatarBtn" aria-label="Modifier la photo">
                                <i class="material-icons-round">edit</i>
                            </button>
                            <input type="file" id="avatarUpload" accept="image/jpeg, image/png, image/webp" style="display: none;">
                        </div>
                        <h2 class="profile-name">...</h2>
                        <p class="profile-subtitle" id="profileSubtitle"></p>
                    </div>

                    <!-- Stats / Onglets cliquables -->
                    <div class="profile-stats-card" style="justify-content: space-around;">
                        <button class="profile-stat profile-tab-btn active" id="tabCreated" data-tab="created" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 8px 20px; border-radius: 12px; transition: background 0.2s;">
                            <span class="profile-stat-value" id="statCreated">0</span>
                            <span class="profile-stat-label">Créées</span>
                        </button>
                        <div class="profile-stat-divider"></div>
                        <button class="profile-stat profile-tab-btn" id="tabJoined" data-tab="joined" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 8px 20px; border-radius: 12px; transition: background 0.2s;">
                            <span class="profile-stat-value" id="statJoined">0</span>
                            <span class="profile-stat-label">Rejointes</span>
                        </button>
                    </div>

                    <!-- Bannière info Boost (dismissible) -->
                    <div class="profile-boost-banner" id="boostBanner">
                        <div class="boost-banner-icon">
                            <i class="material-icons-round">rocket_launch</i>
                        </div>
                        <p class="boost-banner-text">
                            Boostez vos envies pour trouver les personnes avec qui les réaliser rapidement
                        </p>
                        <button class="boost-banner-close" id="closeBanner" aria-label="Fermer le message">
                            <i class="material-icons-round">close</i>
                        </button>
                    </div>

                    <!-- CTA création d'envie -->
                    <button class="profile-create-cta" id="profileCreateBtn">
                        <div class="profile-create-cta-icon">
                            <i class="material-icons-round">add</i>
                        </div>
                        <div class="profile-create-cta-text">
                            <span>Proposer une nouvelle envie</span>
                            <small>Sport, sortie, découverte...</small>
                        </div>
                        <i class="material-icons-round profile-create-cta-arrow">arrow_forward</i>
                    </button>

                    <!-- Section "Mes envies créées" -->
                    <div id="sectionCreated">
                        <h3 class="profile-section-title" style="margin-bottom: 12px;">Mes envies en cours</h3>
                        <div class="profile-desires-list" id="myDesiresList"></div>
                    </div>

                    <!-- Section "Envies rejointes" (cachée par défaut) -->
                    <div id="sectionJoined" style="display: none;">
                        <h3 class="profile-section-title" style="margin-bottom: 12px;">Envies que j'ai rejointes</h3>
                        <div class="profile-desires-list" id="joinedDesiresList"></div>
                    </div>

                    <!-- Section déconnexion -->
                    <div class="profile-actions-section">
                        <button class="profile-action-item">
                            <i class="material-icons-round">notifications_none</i>
                            <span>Notifications</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                        <button class="profile-action-item">
                            <i class="material-icons-round">shield_outlined</i>
                            <span>Confidentialité</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                        <button class="profile-action-item">
                            <i class="material-icons-round">help_outline</i>
                            <span>Aide et support</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                        <button class="profile-action-item profile-logout-btn" id="logoutBtn">
                            <i class="material-icons-round" style="color: #ef4444;">logout</i>
                            <span style="color: #ef4444;">Se déconnecter</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                    </div>

                    <div style="height: 40px;"></div>

                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Retour
        const backBtn = this.querySelector('.back-to-home');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
            });
        }

        // CTA création d'envie
        const createBtn = this.querySelector('#profileCreateBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('navigate-creation', { bubbles: true, composed: true }));
            });
        }

        // Fermer la bannière boost
        const closeBanner = this.querySelector('#closeBanner');
        const boostBanner = this.querySelector('#boostBanner');
        if (closeBanner && boostBanner) {
            closeBanner.addEventListener('click', () => {
                boostBanner.style.opacity = '0';
                boostBanner.style.transform = 'translateY(-8px)';
                setTimeout(() => { boostBanner.style.display = 'none'; }, 300);
            });
        }

        // ── Onglets créées / rejointes ─────────────────────────
        const tabCreated = this.querySelector('#tabCreated');
        const tabJoined = this.querySelector('#tabJoined');
        const sectionCreated = this.querySelector('#sectionCreated');
        const sectionJoined = this.querySelector('#sectionJoined');

        const switchTab = (activeTab) => {
            const isCreated = activeTab === 'created';
            // Styles des onglets
            tabCreated.classList.toggle('active', isCreated);
            tabJoined.classList.toggle('active', !isCreated);
            tabCreated.style.background = isCreated ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : '';
            tabJoined.style.background = !isCreated ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : '';
            tabCreated.style.color = isCreated ? 'var(--primary)' : 'var(--text-muted)';
            tabJoined.style.color = !isCreated ? 'var(--primary)' : 'var(--text-muted)';
            // Afficher la section correspondante
            if (sectionCreated) sectionCreated.style.display = isCreated ? 'block' : 'none';
            if (sectionJoined) sectionJoined.style.display = !isCreated ? 'block' : 'none';
        };

        // État initial
        switchTab('created');

        if (tabCreated) tabCreated.addEventListener('click', () => switchTab('created'));
        if (tabJoined) tabJoined.addEventListener('click', () => switchTab('joined'));

        // Boutons Boost → naviguent vers la page de configuration Boost
        this.querySelectorAll('.boost-cta-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('desire-card');
                const desireId = card?.getAttribute('desire-id') || null;
                const desireTitle = card?.getAttribute('title') || '';
                this.dispatchEvent(new CustomEvent('navigate-boost', {
                    bubbles: true,
                    composed: true,
                    detail: { desireId, desireTitle }
                }));
            });
        });

        // Modification de l'avatar
        const editAvatarBtn = this.querySelector('#editAvatarBtn');
        const avatarUpload = this.querySelector('#avatarUpload');
        const avatarImage = this.querySelector('#avatarImage');

        if (editAvatarBtn && avatarUpload) {
            editAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });

            avatarUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const originalSrc = avatarImage.src;
                avatarImage.style.opacity = '0.5';
                try {
                    const { api } = await import('../../api.js');
                    // Upload vers S3
                    const url = await api.uploadToS3(file);
                    // Sauvegarde dans la base de données
                    await api.updateMe({ avatar_url: url });

                    // Mise à jour visuelle locale
                    avatarImage.src = url;
                    const user = JSON.parse(localStorage.getItem('dystrax-user') || '{}');
                    if (user && Object.keys(user).length > 0) {
                        user.avatar_url = url;
                        localStorage.setItem('dystrax-user', JSON.stringify(user));
                    }
                } catch (err) {
                    console.error('Avatar upload failed', err);
                    alert("Erreur lors de la modification de la photo de profil");
                    avatarImage.src = originalSrc;
                } finally {
                    avatarImage.style.opacity = '1';
                    avatarUpload.value = ''; // trigger reselction
                }
            });
        }

        // Se déconnecter — arrêt session manager + appel api.logout() + redirection login
        const logoutBtn = this.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { api } = await import('../../api.js');
                const { stop: stopSession } = await import('../../utils/sessionManager.js');
                stopSession();

                // Supprimer le token FCM
                import('../../utils/firebaseConfig.js').then(({ deleteCurrentToken }) => {
                    deleteCurrentToken().catch(() => {});
                });

                api.logout();
                this.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
            });
        }

        // Recharger le profil si une envie est refusée (retire la carte de la liste rejointes)
        window.addEventListener('desire-rejected', () => {
            this.loadProfile();
        });
    }

    // Charge et affiche les données réelles du profil depuis l'API
    async loadProfile() {
        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) return;

            const [user, myDesires, joined, myBoosts] = await Promise.all([
                api.getMe(),
                api.getMyDesires(),
                api.getJoinedDesires(),
                api.getMyBoosts().catch(() => []),
            ]);

            // Mise à jour du pseudo et de l'avatar
            const nameEl = this.querySelector('.profile-name');
            const avatarImage = this.querySelector('#avatarImage');
            const subtitleEl = this.querySelector('#profileSubtitle');

            if (nameEl && user?.pseudo) nameEl.textContent = user.pseudo;
            if (avatarImage && user?.avatar_url) avatarImage.src = resolveImageUrl(user.avatar_url) || DEFAULT_AVATAR_PATH;
            if (subtitleEl && user?.created_at) {
                const joinDate = new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                subtitleEl.textContent = `Membre depuis ${joinDate}`;
            }

            // Mise à jour des stats
            const statCreated = this.querySelector('#statCreated');
            const statJoined = this.querySelector('#statJoined');
            if (statCreated) statCreated.textContent = myDesires?.length ?? 0;
            if (statJoined) statJoined.textContent = joined?.length ?? 0;

            // ── Affichage des envies créées ──────────────────────────
            const myDesiresList = this.querySelector('#myDesiresList');
            if (myDesiresList) {
                myDesiresList.innerHTML = '';

                // IDs des envies avec un boost actif
                const activeBoostIds = new Set((myBoosts || []).map(b => String(b.desire_id)));

                if (myDesires && myDesires.length > 0) {
                    myDesires.forEach(desire => {
                        const eventDate = new Date(desire.event_date);
                        const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                        const imagesStr = desire.images ? desire.images.join(',') : '';

                        const diff = (Date.now() - new Date(desire.created_at)) / 1000;
                        let timeAgo = `À l'instant`;
                        if (diff >= 60 && diff < 3600) timeAgo = `Il y a ${Math.floor(diff / 60)} min`;
                        else if (diff >= 3600 && diff < 86400) timeAgo = `Il y a ${Math.floor(diff / 3600)}h`;
                        else if (diff >= 86400) timeAgo = `Il y a ${Math.floor(diff / 86400)} jour(s)`;

                        let priceStr = 'Gratuit';
                        if (desire.price_type === 'contribution') priceStr = 'Contribution libre';
                        else if (desire.price_type === 'paid') priceStr = desire.price_amount ? desire.price_amount + ' FCFA' : 'Payant';

                        const authorAvatar = resolveImageUrl(user.avatar_url) || '/assets/img/avatar.png';
                        const hasActiveBoost = activeBoostIds.has(String(desire.id));
                        myDesiresList.innerHTML += `
                            <desire-card 
                                mode="profile"
                                desire-id="${escapeHtml(String(desire.id))}"
                                data-author-id="${escapeHtml(String(user.id))}"
                                theme="${escapeHtml(desire.category || 'explore')}" 
                                author="${escapeHtml(user.pseudo || '')}" 
                                time-ago="${escapeHtml(timeAgo)}" 
                                avatar="${escapeHtml(authorAvatar)}" 
                                title="${escapeHtml(desire.title)}"
                                date="${escapeHtml(dateStr)}" 
                                price="${escapeHtml(priceStr)}" 
                                spots="${escapeHtml(formatSpotsLabel(desire.spots_taken, desire.max_spots))}"
                                images="${escapeHtml(imagesStr)}"
                                description="${escapeHtml(desire.description || '')}"
                                show-boost
                                ${hasActiveBoost ? 'has-active-boost' : ''}
                                ${hasActiveBoost ? 'is-boosted' : ''}
                            ></desire-card>
                        `;
                    });
                } else {
                    myDesiresList.innerHTML = `
                        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                            <i class="material-icons-round" style="font-size: 48px; opacity: 0.5; margin-bottom: 12px;">hourglass_empty</i>
                            <p>Vous n'avez pas encore publié d'envie.</p>
                        </div>
                    `;
                }
            }

            // ── Affichage des envies rejointes ───────────────────────
            const joinedList = this.querySelector('#joinedDesiresList');
            if (joinedList) {
                joinedList.innerHTML = '';

                if (joined && joined.length > 0) {
                    joined.forEach(desire => {
                        const eventDate = new Date(desire.event_date);
                        const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                        const imagesStr = desire.images ? desire.images.join(',') : '';

                        const diff = (Date.now() - new Date(desire.created_at)) / 1000;
                        let timeAgo = `À l'instant`;
                        if (diff >= 60 && diff < 3600) timeAgo = `Il y a ${Math.floor(diff / 60)} min`;
                        else if (diff >= 3600 && diff < 86400) timeAgo = `Il y a ${Math.floor(diff / 3600)}h`;
                        else if (diff >= 86400) timeAgo = `Il y a ${Math.floor(diff / 86400)} jour(s)`;

                        let priceStr = 'Gratuit';
                        if (desire.price_type === 'contribution') priceStr = 'Contribution libre';
                        else if (desire.price_type === 'paid') priceStr = desire.price_amount ? desire.price_amount + ' FCFA' : 'Payant';

                        // Trouver l'auteur si disponible
                        const authorPseudo = desire.author?.pseudo || desire.author_pseudo || 'Organisateur';
                        const authorAvatarSafe = resolveImageUrl(desire.author?.avatar_url || desire.author_avatar) || DEFAULT_AVATAR_PATH;

                        const currentMode = desire.status === 'pending' ? 'pending' : 'joined';

                        joinedList.innerHTML += `
                            <desire-card 
                                mode="${currentMode}"
                                desire-id="${escapeHtml(String(desire.id))}"
                                theme="${escapeHtml(desire.category || 'explore')}" 
                                author="${escapeHtml(authorPseudo)}" 
                                time-ago="${escapeHtml(timeAgo)}" 
                                avatar="${escapeHtml(authorAvatarSafe)}" 
                                title="${escapeHtml(desire.title)}"
                                date="${escapeHtml(dateStr)}" 
                                price="${escapeHtml(priceStr)}" 
                                spots="${escapeHtml(formatSpotsLabel(desire.spots_taken, desire.max_spots))}"
                                images="${escapeHtml(imagesStr)}"
                                description="${escapeHtml(desire.description || '')}"
                            ></desire-card>
                        `;
                    });
                } else {
                    joinedList.innerHTML = `
                        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                            <i class="material-icons-round" style="font-size: 48px; opacity: 0.5; margin-bottom: 12px;">explore</i>
                            <p>Vous n'avez pas encore rejoint d'envie.</p>
                        </div>
                    `;
                }
            }
            // Masquer les boutons boost si la feature est désactivée
            try {
                const { isFeatureEnabled } = await import('../../utils/featureFlags.js');
                if (!await isFeatureEnabled('boost_activate')) {
                    this.querySelectorAll('.boost-inline-btn, .boost-cta-btn').forEach(btn => {
                        btn.style.display = 'none';
                    });
                }
            } catch { /* fail-open */ }

        } catch (err) {
            console.warn('Profil non chargé :', err.message);
        }
    }

    show() {
        this.querySelector('#profilePage').style.display = 'block';
        this.loadProfile();
    }

    hide() {
        this.querySelector('#profilePage').style.display = 'none';
    }
}

customElements.define('app-profile-page', ProfilePage);

