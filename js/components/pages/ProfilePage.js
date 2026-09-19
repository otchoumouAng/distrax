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
                        <button class="profile-action-item" id="installAppBtn" style="display: none;">
                            <i class="material-icons-round">install_mobile</i>
                            <span>Installer Dystrax</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                        <button class="profile-action-item" id="notifPrefsBtn">
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
                        <!-- Console d'administration (MNO-12) : révéler uniquement
                             aux comptes habilités ; l'entrée reste absente du DOM
                             visible pour tous les autres. -->
                        <button class="profile-action-item" id="adminBtn" style="display: none;">
                            <i class="material-icons-round">admin_panel_settings</i>
                            <span>Administration</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                        <button class="profile-action-item profile-logout-btn" id="logoutBtn">
                            <i class="material-icons-round" style="color: #ef4444;">logout</i>
                            <span style="color: #ef4444;">Se déconnecter</span>
                            <i class="material-icons-round profile-action-arrow">chevron_right</i>
                        </button>
                    </div>

                    <!-- Pays de résidence effectif + correction (§7 PER-05).
                         Placé après les menus, sans fond ni bordure. -->
                    <div id="profileCountryRow" style="display: flex; align-items: center; gap: 8px; margin: 8px 16px 0; padding: 8px 0;">
                        <p id="profileCountryLabel" style="margin: 0; flex: 1; min-width: 0; font-size: 13px; color: var(--text-muted);">Pays de résidence : ...</p>
                        <button type="button" id="profileCountryEdit" style="background: none; border: none; color: var(--primary); font-weight: 600; font-size: 13px; cursor: pointer; padding: 4px;">Modifier</button>
                    </div>
                    <div id="profileCountryPicker" style="display: none; margin: 8px 16px 0;">
                        <select id="profileCountrySelect" style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-main); font-size: 15px; font-family: inherit;"></select>
                        <p id="profileCountryHint" style="margin: 8px 0 0; font-size: 12px; color: var(--text-muted);"></p>
                    </div>

                    <div style="height: 40px;"></div>

                </div>

                <!-- Réglages de notification par catégorie (MNO-08). Le choix
                     vaut pour tous les émetteurs, y compris les envois
                     transactionnels. -->
                <div id="notifPrefsOverlay" role="dialog" aria-modal="true" aria-labelledby="notifPrefsTitle"
                     style="display: none; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45); align-items: flex-end; justify-content: center;">
                    <div style="background: var(--bg-card); width: 100%; max-width: 560px; max-height: 85svh; overflow-y: auto; border-radius: 20px 20px 0 0; padding: 20px 20px 32px; box-shadow: 0 -8px 32px rgba(0,0,0,0.2);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <h2 id="notifPrefsTitle" style="margin: 0; font-size: 18px; flex: 1;">Notifications</h2>
                            <button type="button" id="notifPrefsClose" aria-label="Fermer"
                                    style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex;">
                                <i class="material-icons-round">close</i>
                            </button>
                        </div>
                        <p style="margin: 4px 0 16px; font-size: 13px; color: var(--text-muted); line-height: 1.5;">
                            Choisis les catégories qui peuvent t'envoyer des notifications.
                        </p>
                        <div id="notifPrefsList" style="display: flex; flex-direction: column;">
                            <p style="color: var(--text-muted); text-align: center; padding: 24px 0;">Chargement...</p>
                        </div>
                        <p style="margin: 16px 0 0; font-size: 12px; color: var(--text-light); line-height: 1.5;">
                            Les annulations et modifications de dernière minute, ainsi que les liens de réinitialisation du mot de passe, te sont toujours signalés.
                        </p>
                    </div>
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

        // Console d'administration (MNO-12) — entrée visible seulement pour les
        // comptes habilités (voir loadProfile), la garde réelle restant l'API.
        const adminBtn = this.querySelector('#adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('navigate-admin', { bubbles: true, composed: true }));
            });
        }

        // Réglages de notification par catégorie (MNO-08).
        const notifPrefsBtn = this.querySelector('#notifPrefsBtn');
        if (notifPrefsBtn) {
            notifPrefsBtn.addEventListener('click', () => this.openNotificationPreferences());
        }
        const notifPrefsClose = this.querySelector('#notifPrefsClose');
        if (notifPrefsClose) {
            notifPrefsClose.addEventListener('click', () => this.closeNotificationPreferences());
        }
        const notifPrefsOverlay = this.querySelector('#notifPrefsOverlay');
        if (notifPrefsOverlay) {
            notifPrefsOverlay.addEventListener('click', (event) => {
                if (event.target === notifPrefsOverlay) this.closeNotificationPreferences();
            });
        }

        // Se déconnecter — arrêt session manager + appel api.logout() + redirection login
        const logoutBtn = this.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { api } = await import('../../api.js');
                const { stop: stopSession } = await import('../../utils/sessionManager.js');
                stopSession();

                // Marquer l'appareil comme déconnecté tant que le jeton
                // d'authentification est encore disponible pour l'appel
                // backend : il ne recevra plus que les liens de
                // réinitialisation du mot de passe.
                const { markCurrentDeviceLoggedOut } = await import('../../utils/firebaseConfig.js');
                await markCurrentDeviceLoggedOut();

                api.logout();
                this.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
            });
        }

        // Pays de résidence — correction manuelle (§7, GEO-08)
        const countryEditBtn = this.querySelector('#profileCountryEdit');
        if (countryEditBtn) {
            countryEditBtn.addEventListener('click', () => this._openCountryPicker());
        }
        const countrySelect = this.querySelector('#profileCountrySelect');
        if (countrySelect) {
            countrySelect.addEventListener('change', () => this._applyCountryChoice(countrySelect.value));
        }

        // Installer Dystrax — entrée permanente masquée si déjà installée (PWA-02/05)
        const installBtn = this.querySelector('#installAppBtn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                const { startInstallFlow } = await import('../../utils/installPWA.js');
                await startInstallFlow('Installez Dystrax pour être prévenu de vos envies, même application fermée.');
            });
        }
        this.refreshInstallEntry();

        // Recharger le profil si une envie est refusée (retire la carte de la liste rejointes)
        window.addEventListener('desire-rejected', () => {
            this.loadProfile();
        });
    }

    // Affiche l'entrée d'installation uniquement si elle est pertinente (PWA-05)
    async refreshInstallEntry() {
        const installBtn = this.querySelector('#installAppBtn');
        if (!installBtn) return;
        try {
            const { isStandalone, isInstallSupported } = await import('../../utils/installPWA.js');
            installBtn.style.display = (!isStandalone() && isInstallSupported()) ? 'flex' : 'none';
        } catch {
            installBtn.style.display = 'none';
        }
    }

    // Charge et affiche les données réelles du profil depuis l'API
    async loadProfile() {
        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) return;

            const [user, myDesires, joined, myBoosts, boostFeatures] = await Promise.all([
                api.getMe(),
                api.getMyDesires(),
                api.getJoinedDesires(),
                api.getMyBoosts().catch(() => []),
                api.getFeatures('boost').catch(() => null),
            ]);

            const boostActivateFeature = boostFeatures?.features?.find(f => f.slug === 'boost_activate');
            const isBoostEnabled = boostActivateFeature ? boostActivateFeature.is_active : true;

            const boostBanner = this.querySelector('#boostBanner');
            if (boostBanner && !isBoostEnabled) {
                boostBanner.style.display = 'none';
            }

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

            // Entrée « Administration » (MNO-12) : réservée aux comptes habilités
            const adminEntry = this.querySelector('#adminBtn');
            if (adminEntry) adminEntry.style.display = user?.is_admin ? 'flex' : 'none';

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
                                spots="${escapeHtml(formatSpotsLabel(desire.spots_taken, desire.max_spots, desire.is_unlimited))}"
                                images="${escapeHtml(imagesStr)}"
                                description="${escapeHtml(desire.description || '')}"
                                icon="${escapeHtml(desire.category_icon || desire.category || 'label')}"
                                desire-status="${escapeHtml(desire.desire_status || '')}"
                                ${desire.needs_maintenance ? 'needs-maintenance' : ''}
                                ${isBoostEnabled ? 'show-boost' : ''}
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

                        // 'confirmed' = présence confirmée, participation active (PAR-08)
                        const currentMode = (desire.status === 'accepted' || desire.status === 'confirmed') ? 'joined' : 'pending';

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
                                spots="${escapeHtml(formatSpotsLabel(desire.spots_taken, desire.max_spots, desire.is_unlimited))}"
                                images="${escapeHtml(imagesStr)}"
                                description="${escapeHtml(desire.description || '')}"
                                icon="${escapeHtml(desire.category_icon || desire.category || 'label')}"
                                desire-status="${escapeHtml(desire.desire_status || '')}"
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

    // ── Pays de résidence effectif (§7, GEO-08) ──────────────────

    /** Résout le libellé lisible du pays à partir du contexte API. */
    _resolveCountryLabel(context, countries, code) {
        const country = context?.country;
        const fromContext = (country && typeof country === 'object') ? (country.label || country.name) : null;
        if (fromContext) return fromContext;
        const match = (countries || []).find((item) => item && item.code === code);
        return match?.label || code;
    }

    /**
     * Affiche le pays de résidence effectif. Un pays simplement détecté est
     * présenté comme tel afin d'inviter à la correction.
     */
    async refreshCountryLabel() {
        const labelEl = this.querySelector('#profileCountryLabel');
        if (!labelEl) return;
        const { api } = await import('../../api.js');
        // On interroge toujours l'API : le pays peut venir du compte ou de la
        // détection IP sans être encore mémorisé localement.
        const storedCode = api.getCountryCode();
        try {
            const [context, countries] = await Promise.all([
                api.getCountryContext(),
                api.getCountries().catch(() => []),
            ]);
            const code = context?.country_code || storedCode;
            if (!code) {
                labelEl.textContent = 'Pays de résidence : non défini';
                return;
            }
            const label = this._resolveCountryLabel(context, countries, code);
            // Le pays n'est « de résidence » qu'après confirmation explicite
            // (`user_confirmed`, §14) ; une détection IP reste présentée comme
            // telle afin d'inviter à la correction.
            const detected = context?.source && context.source !== 'user_confirmed';
            labelEl.textContent = `${detected ? 'Pays détecté' : 'Pays de résidence'} : ${label}`;
        } catch (err) {
            // Repli : afficher le code mémorisé plutôt que de laisser « ... ».
            labelEl.textContent = storedCode
                ? `Pays de résidence : ${storedCode}`
                : 'Pays de résidence : non défini';
        }
    }

    /** Ouvre le sélecteur de pays et le peuple depuis l'API (GEO-08). */
    async _openCountryPicker() {
        const picker = this.querySelector('#profileCountryPicker');
        const select = this.querySelector('#profileCountrySelect');
        const hint = this.querySelector('#profileCountryHint');
        if (!picker || !select) return;
        picker.style.display = 'block';
        if (hint) hint.textContent = 'Chargement des pays...';
        try {
            const { api } = await import('../../api.js');
            const countries = (await api.getCountries())
                .filter((c) => c && c.code && c.is_active !== false);
            const current = api.getCountryCode();
            select.innerHTML = countries
                .map((c) => `<option value="${escapeHtml(c.code)}"${c.code === current ? ' selected' : ''}>${escapeHtml(c.label || c.code)}</option>`)
                .join('');
            if (countries.some((c) => c.code === current)) select.value = current;
            if (hint) hint.textContent = countries.length
                ? 'Choisis le pays dans lequel tu résides.'
                : 'Aucun pays disponible pour le moment.';
        } catch (err) {
            console.warn('[ProfilePage] Pays non chargés:', err.message);
            if (hint) hint.textContent = 'Impossible de charger la liste des pays.';
        }
    }

    /**
     * Applique le pays choisi : le contexte est enregistré côté API, puis les
     * données dépendantes du pays sont rechargées de façon cohérente (VIS-10).
     */
    async _applyCountryChoice(code) {
        if (!code) return;
        const picker = this.querySelector('#profileCountryPicker');
        const hint = this.querySelector('#profileCountryHint');
        if (hint) hint.textContent = 'Enregistrement...';
        try {
            const { api } = await import('../../api.js');
            const context = await api.setCountryContext(code);
            const label = this._resolveCountryLabel(context, [], context?.country_code || code);
            const labelEl = this.querySelector('#profileCountryLabel');
            if (labelEl) labelEl.textContent = `Pays de résidence : ${label}`;
            if (picker) picker.style.display = 'none';
            if (hint) hint.textContent = '';
            // Réalignement cohérent : l'exploration et la modale de filtres
            // écoutent cet événement pour recharger leurs données par pays.
            document.dispatchEvent(new CustomEvent('country-context-changed', {
                detail: { country_code: code, source: 'profile' },
            }));
        } catch (err) {
            console.warn('[ProfilePage] Changement de pays échoué:', err.message);
            if (hint) hint.textContent = 'Le pays n\'a pas pu être enregistré. Réessaie.';
        }
    }

    // ── Réglages de notification par catégorie (MNO-08) ──────────

    openNotificationPreferences() {
        const overlay = this.querySelector('#notifPrefsOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        this.loadNotificationPreferences();
    }

    closeNotificationPreferences() {
        const overlay = this.querySelector('#notifPrefsOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    async loadNotificationPreferences() {
        const list = this.querySelector('#notifPrefsList');
        if (!list) return;
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px 0;">Chargement...</p>';
        try {
            const { api } = await import('../../api.js');
            const data = await api.getNotificationPreferences();
            this.renderNotificationPreferences(data?.categories || []);
        } catch (err) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px 0;">Impossible de charger les réglages.</p>';
        }
    }

    renderNotificationPreferences(categories) {
        const list = this.querySelector('#notifPrefsList');
        if (!list) return;
        if (!categories.length) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px 0;">Aucune catégorie disponible.</p>';
            return;
        }

        list.innerHTML = categories.map(category => `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-main);">${escapeHtml(category.label)}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.4;">${escapeHtml(category.description)}</div>
                </div>
                <label style="position: relative; display: inline-block; width: 44px; height: 26px; flex-shrink: 0; cursor: pointer;">
                    <input type="checkbox" data-category-slug="${escapeHtml(category.slug)}" ${category.enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                    <span class="notif-prefs-track" style="position: absolute; inset: 0; border-radius: 100px; transition: background 0.2s;"></span>
                    <span class="notif-prefs-knob" style="position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.2s;"></span>
                </label>
            </div>`).join('');

        list.querySelectorAll('input[data-category-slug]').forEach(input => {
            this._paintNotifToggle(input, input.checked);
            input.addEventListener('change', () => {
                this.saveNotificationPreference(input.dataset.categorySlug, input.checked, input);
            });
        });
    }

    _paintNotifToggle(input, enabled) {
        const track = input.parentElement?.querySelector('.notif-prefs-track');
        const knob = input.parentElement?.querySelector('.notif-prefs-knob');
        if (track) track.style.background = enabled ? 'var(--primary)' : 'var(--border-light)';
        if (knob) knob.style.left = enabled ? '23px' : '3px';
    }

    async saveNotificationPreference(slug, enabled, input) {
        try {
            const { api } = await import('../../api.js');
            const data = await api.updateNotificationPreferences({ [slug]: enabled });
            const category = (data?.categories || []).find(item => item.slug === slug);
            const effective = category ? category.enabled : enabled;
            input.checked = effective;
            this._paintNotifToggle(input, effective);
        } catch (err) {
            // Un réglage non enregistré ne doit pas laisser l'interrupteur dans
            // un état que le serveur ignore : on revient au choix précédent.
            input.checked = !enabled;
            this._paintNotifToggle(input, !enabled);
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: 'Réglage non enregistré. Réessaie.', type: 'error' },
            }));
        }
    }

    show() {
        this.querySelector('#profilePage').style.display = 'block';
        this.refreshInstallEntry();
        this.refreshCountryLabel();
        this.loadProfile();
    }

    hide() {
        this.querySelector('#profilePage').style.display = 'none';
    }
}

customElements.define('app-profile-page', ProfilePage);

