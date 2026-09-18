/**
 * AdminPage — Console d'administration du moteur de notifications (MNO-12).
 *
 * Sept écrans dans une seule page, dans l'ordre où l'exploitation les
 * consulte : l'état de la file d'envoi, les interrupteurs du moteur et la
 * fenêtre d'envoi paramétrable (MNO-15), le mode de gratuité du ciblage, le
 * catalogue des référentiels (MNO-17), les campagnes de notification (MNO-18),
 * la liste filtrée des comptes (MNO-19) avec leur blocage (MNO-19a), puis la
 * recherche d'un compte — avec, pour ce dernier, son journal de livraison
 * (MNO-12b), son diagnostic (MNO-13) et un envoi de test (MNO-12c).
 *
 * La page n'est qu'un confort : toutes les routes qu'elle appelle répondent 403
 * à un compte non habilité. La garde locale évite d'afficher un écran vide.
 */
import { api } from '../../api.js';
import { escapeHtml, DEFAULT_AVATAR_PATH } from '../../utils/escapeHtml.js';
import { resolveImageUrl } from '../../utils/imageUrl.js';

/** Interrupteurs simples du moteur, dans l'ordre d'affichage (MNO-12a, MNO-06, MNO-07). */
const ENGINE_SWITCHES = [
    { slug: 'notif_engine_enabled', label: 'Moteur de notifications', hint: 'Arrêt d’urgence : coupe les envois automatiques.', danger: true },
    { slug: 'notif_quiet_hours', label: 'Fenêtre d’envoi', hint: 'Les envois non critiques ne partent qu’entre l’ouverture et la fermeture.' },
    { slug: 'notif_daily_cap', label: 'Plafond quotidien', hint: 'Limite les envois non critiques par compte et par jour.' },
];

/** Jours du week-end, indexés sur `date.weekday()` (0 = lundi … 6 = dimanche). */
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const OUTBOX_STATUS_LABELS = {
    pending: 'En attente',
    sent: 'Envoyés',
    failed: 'Échoués',
    skipped: 'Abandonnés',
};

const DELIVERY_STATUS_LABELS = {
    attempted: 'Tenté',
    sent: 'Livré',
    failed: 'Échec',
};

const DELIVERY_STATUS_COLORS = {
    attempted: 'var(--text-muted)',
    sent: '#10b981',
    failed: '#ef4444',
};

const SEVERITY_LABELS = { blocking: 'Bloquant', warning: 'Vigilance' };
const SEVERITY_COLORS = { blocking: '#ef4444', warning: '#f59e0b' };

/** Motifs de report et d'abandon, tels que le moteur les écrit en base (MNO-13a). */
const REASON_LABELS = {
    engine_disabled: 'Moteur arrêté',
    category_disabled: 'Catégorie coupée par l’utilisateur',
    out_of_window: 'Reporté à la prochaine ouverture',
    daily_cap: 'Reporté au lendemain (plafond atteint)',
    no_device: 'Aucun appareil joignable',
    provider_failure: 'Échec du prestataire',
};

/** États d'une campagne, tels que le modèle les écrit (MNO-18c). */
const CAMPAIGN_STATUS_LABELS = {
    scheduled: 'Programmée',
    dispatching: 'Départ en cours',
    dispatched: 'Remise à la file',
    cancelled: 'Annulée',
    failed: 'Échec',
};

const CAMPAIGN_STATUS_COLORS = {
    scheduled: '#f59e0b',
    dispatching: '#3b82f6',
    dispatched: '#10b981',
    cancelled: 'var(--text-muted)',
    failed: '#ef4444',
};

/** Motifs d'échec d'une campagne, repliés sur le code brut s'ils sont inconnus. */
const CAMPAIGN_REASON_LABELS = {
    dispatch_failed: 'Remise à la file impossible',
    cancelled_before_dispatch: 'Annulée avant le départ',
};

const AUDIENCE_LABELS = {
    all: 'Tout le monde',
    selected: 'Sélection',
};

const AUDIENCE_HINTS = {
    all: 'Tous les comptes existants au moment de la validation.',
    selected: 'Uniquement les comptes cochés ci-dessous.',
};

const CHANNEL_LABELS = { push: 'Notification push' };

/**
 * L'accueil de la console présente une tuile par section ; une seule section
 * est dépliée à la fois. Le libellé sert aussi de titre au header.
 */
const ADMIN_SECTIONS = [
    {
        key: 'outbox',
        icon: 'outbox',
        label: 'File d’envoi',
        hint: 'Envois proactifs par statut.',
    },
    {
        key: 'engine',
        icon: 'tune',
        label: 'Moteur',
        hint: 'Interrupteurs, fenêtre d’envoi et ciblage.',
    },
    {
        key: 'catalog',
        icon: 'category',
        label: 'Référentiels',
        hint: 'Catégories, communes, prix, paiement, boost.',
    },
    {
        key: 'campaigns',
        icon: 'campaign',
        label: 'Campagnes',
        hint: 'Rédiger, cibler et programmer un message.',
    },
    {
        key: 'users',
        icon: 'group',
        label: 'Utilisateurs',
        hint: 'Comptes, appareils, blocage et inspection.',
    },
];

const SECTION_TITLES = Object.fromEntries(
    ADMIN_SECTIONS.map(({ key, label }) => [key, label]),
);

/** Les volumes se lisent d'un coup d'œil : « 1 248 » plutôt que « 1248 ». */
function formatCount(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

/** Motif lisible d'une ligne de file, replié sur le code brut s'il est inconnu. */
function reasonLabel(reason) {
    if (!reason) return '';
    return REASON_LABELS[reason] || reason;
}

function severityBadge(severity) {
    const label = SEVERITY_LABELS[severity] || severity;
    const color = SEVERITY_COLORS[severity] || 'var(--text-muted)';
    return `<span class="admin-badge" style="color:${color};border-color:${color};">${escapeHtml(label)}</span>`;
}

export class AdminPage extends HTMLElement {
    constructor() {
        super();
        this._user = null;
        this._searchResults = [];
        this._catalogs = [];
        this._catalogKey = null;
        this._campaignOptions = { channels: [], audience_modes: [] };
        this._campaignAudience = 'all';
        this._campaignPicked = new Map();
        this._campaignResults = [];
        this._userFilters = { q: '', device: '', blocked: false, admin: false, page: 1 };
        // Section ouverte (null = accueil), sections déjà chargées, et résumés
        // ramenés pour les tuiles en attente d'être consommés par leur section.
        this._section = null;
        this._loaded = new Set();
        this._summary = {};
    }

    connectedCallback() {
        this.innerHTML = `
            <section class="page-section admin-page" id="adminPage">
                <header class="profile-sticky-header">
                    <button class="round-icon-btn admin-back" title="Retour" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <span class="profile-header-title" id="adminTitle">Administration</span>
                    <button class="round-icon-btn admin-refresh" title="Actualiser" aria-label="Actualiser">
                        <i class="material-icons-round">refresh</i>
                    </button>
                </header>

                <div class="profile-body">

                    <!-- Accueil : une tuile par section, le contenu suit le clic -->
                    <div class="admin-tiles" id="adminTiles">
                        ${this._tilesHtml()}
                    </div>

                    <!-- État de la file d'envoi (MNO-09) -->
                    <div class="admin-card" data-admin-section="outbox" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">outbox</i> File d’envoi
                        </h3>
                        <p class="admin-card-hint">
                            Envois proactifs par statut. Une accumulation en attente ou en
                            échec signale un moteur arrêté ou un prestataire indisponible.
                        </p>
                        <div class="admin-chips" id="adminOutboxCounts">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                    </div>

                    <!-- Interrupteurs du moteur -->
                    <div class="admin-card" data-admin-section="engine" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">tune</i> Moteur
                        </h3>
                        <p class="admin-card-hint">
                            Appliqués immédiatement, sans redéploiement. Les envois
                            transactionnels (demandes, sécurité du compte) ne sont pas concernés.
                        </p>
                        <div id="adminEngineSwitches">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                        <div id="adminSettings"></div>
                    </div>

                    <!-- Gratuité du ciblage (MNO-05) -->
                    <div class="admin-card" data-admin-section="engine" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">ads_click</i> Ciblage des envies
                        </h3>
                        <p class="admin-card-hint">
                            Mode de gratuité de la proposition d’envies. Un seul mode à la fois.
                        </p>
                        <div id="adminTargeting">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                    </div>

                    <!-- Catalogue des référentiels (MNO-17) -->
                    <div class="admin-card" data-admin-section="catalog" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">category</i> Référentiels
                        </h3>
                        <p class="admin-card-hint">
                            Catégories, communes, types de prix, modes de paiement et
                            système de boost. Une entrée se désactive, elle ne se
                            supprime pas : les envies publiées la référencent.
                        </p>
                        <div class="admin-tabs" id="adminCatalogTabs">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                        <div id="adminCatalogBody"></div>
                    </div>

                    <!-- Campagnes de notification (MNO-18) -->
                    <div class="admin-card" data-admin-section="campaigns" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">campaign</i> Campagnes
                        </h3>
                        <p class="admin-card-hint">
                            Rédiger un message, choisir les destinataires, puis fixer
                            l’heure. L’audience est figée à la validation, et l’envoi
                            respecte la fenêtre, le plafond quotidien et le choix de
                            catégorie de chaque compte.
                        </p>

                        <form id="adminCampaignForm" class="admin-campaign-form">
                            <input class="form-input" id="adminCampaignTitle" type="text"
                                   maxlength="200" placeholder="Titre du message" autocomplete="off">
                            <textarea class="form-input admin-campaign-body" id="adminCampaignBody"
                                      maxlength="2000" rows="3" placeholder="Message"></textarea>

                            <div class="admin-setting-row">
                                <label class="admin-setting-text" for="adminCampaignChannel">
                                    <span class="admin-setting-label">Canal</span>
                                    <span class="admin-setting-hint">Le push est le canal par défaut.</span>
                                </label>
                                <select class="form-input admin-setting-input" id="adminCampaignChannel"></select>
                            </div>

                            <div class="admin-setting-row">
                                <label class="admin-setting-text" for="adminCampaignWhen">
                                    <span class="admin-setting-label">Date et heure</span>
                                    <span class="admin-setting-hint">
                                        Vide ou déjà passée : l’envoi part immédiatement.
                                    </span>
                                </label>
                                <input class="form-input admin-setting-input" id="adminCampaignWhen"
                                       type="datetime-local">
                            </div>

                            <h4 class="admin-section-title">Destinataires</h4>
                            <div id="adminCampaignAudience"></div>
                            <div id="adminCampaignSelection" hidden>
                                <div class="admin-search-form">
                                    <input class="form-input" id="adminCampaignSearchInput" type="search"
                                           placeholder="Pseudo ou numéro de téléphone" autocomplete="off">
                                    <button type="button" class="admin-search-btn"
                                            id="adminCampaignSearchBtn" aria-label="Rechercher">
                                        <i class="material-icons-round">search</i>
                                    </button>
                                </div>
                                <div id="adminCampaignSearchResults"></div>
                                <div class="admin-chips" id="adminCampaignPicked"></div>
                            </div>

                            <div class="admin-campaign-actions">
                                <button type="button" class="admin-test-btn" id="adminCampaignPreview">
                                    <i class="material-icons-round">visibility</i> Aperçu
                                </button>
                                <button type="submit" class="admin-settings-save" id="adminCampaignSubmit">
                                    <i class="material-icons-round">send</i> Valider
                                </button>
                            </div>
                            <div id="adminCampaignFeedback"></div>
                        </form>

                        <h4 class="admin-section-title">Campagnes récentes</h4>
                        <div id="adminCampaignList">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                    </div>

                    <!-- Suivi et gestion des comptes (MNO-19) -->
                    <div class="admin-card" data-admin-section="users" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">group</i> Utilisateurs
                        </h3>
                        <p class="admin-card-hint">
                            Liste filtrée des comptes : ceux qui ont installé
                            l’application, ceux dont les appareils sont déconnectés,
                            les comptes bloqués. Le blocage prend effet à la requête
                            suivante du compte visé.
                        </p>

                        <form id="adminUserFilters" class="admin-user-filters">
                            <input class="form-input" id="adminUserQuery" type="search"
                                   placeholder="Pseudo ou numéro de téléphone" autocomplete="off">
                            <select class="form-input" id="adminUserDevice">
                                <option value="">Tous les appareils</option>
                                <option value="installed">Application installée</option>
                                <option value="logged_out">Appareils déconnectés</option>
                                <option value="none">Jamais installé</option>
                            </select>
                            <div class="admin-user-toggles">
                                <label class="admin-user-toggle">
                                    <input type="checkbox" id="adminUserBlocked">
                                    <span>Bloqués</span>
                                </label>
                                <label class="admin-user-toggle">
                                    <input type="checkbox" id="adminUserAdmin">
                                    <span>Administrateurs</span>
                                </label>
                            </div>
                            <div class="admin-campaign-actions">
                                <button type="submit" class="admin-test-btn">
                                    <i class="material-icons-round">filter_alt</i> Filtrer
                                </button>
                                <button type="button" class="admin-settings-save" id="adminUserReset">
                                    <i class="material-icons-round">restart_alt</i> Réinitialiser
                                </button>
                            </div>
                        </form>

                        <div id="adminUserList">
                            <span class="admin-placeholder">Chargement…</span>
                        </div>
                        <div class="admin-pager" id="adminUserPager"></div>
                    </div>

                    <!-- Recherche et inspection d'un compte -->
                    <div class="admin-card" data-admin-section="users" hidden>
                        <h3 class="admin-card-title">
                            <i class="material-icons-round">manage_search</i> Comptes
                        </h3>
                        <p class="admin-card-hint">
                            Retrouver un compte pour lire ce qui lui a été envoyé et
                            comprendre ce qui ne lui est pas parvenu.
                        </p>
                        <form id="adminSearchForm" class="admin-search-form">
                            <input class="form-input" id="adminSearchInput" type="search"
                                   placeholder="Pseudo ou numéro de téléphone" autocomplete="off">
                            <button type="submit" class="admin-search-btn" aria-label="Rechercher">
                                <i class="material-icons-round">search</i>
                            </button>
                        </form>
                        <div id="adminSearchResults"></div>
                        <div id="adminUserPanel"></div>
                    </div>

                    <div style="height: 40px;"></div>
                </div>
            </section>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        this.querySelector('.admin-back')?.addEventListener('click', () => {
            // Le retour ramène d'abord à l'accueil de la console : quitter la
            // page entière demande un second geste, explicite.
            if (this._section) {
                this._closeSection();
                return;
            }
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });

        this.querySelector('.admin-refresh')?.addEventListener('click', () => this.load());

        this.querySelectorAll('.admin-tile').forEach((tile) => {
            tile.addEventListener('click', () => this._openSection(tile.dataset.section));
        });

        this.querySelector('#adminSearchForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._search();
        });

        this.querySelector('#adminCampaignForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._submitCampaign();
        });
        this.querySelector('#adminCampaignPreview')
            ?.addEventListener('click', () => this._previewCampaign());
        this.querySelector('#adminCampaignSearchBtn')
            ?.addEventListener('click', () => this._searchCampaignUsers());
        this.querySelector('#adminCampaignSearchInput')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._searchCampaignUsers();
            }
        });

        this.querySelector('#adminUserFilters')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this._userFilters = { ...this._readUserFilters(), page: 1 };
            this._loadUserDirectory();
        });
        this.querySelector('#adminUserReset')?.addEventListener('click', () => {
            this._userFilters = { q: '', device: '', blocked: false, admin: false, page: 1 };
            this._renderUserFilters();
            this._loadUserDirectory();
        });
    }

    /** Reporte les filtres retenus dans le formulaire (état conservé entre deux chargements). */
    _renderUserFilters() {
        const filters = this._userFilters;
        const query = this.querySelector('#adminUserQuery');
        const device = this.querySelector('#adminUserDevice');
        const blocked = this.querySelector('#adminUserBlocked');
        const admin = this.querySelector('#adminUserAdmin');
        if (query) query.value = filters.q || '';
        if (device) device.value = filters.device || '';
        if (blocked) blocked.checked = !!filters.blocked;
        if (admin) admin.checked = !!filters.admin;
    }

    _readUserFilters() {
        return {
            q: this.querySelector('#adminUserQuery')?.value.trim() || '',
            device: this.querySelector('#adminUserDevice')?.value || '',
            blocked: !!this.querySelector('#adminUserBlocked')?.checked,
            admin: !!this.querySelector('#adminUserAdmin')?.checked,
        };
    }

    /** Les filtres n'ont pas encore été touchés : la première page est « la » liste. */
    _isDefaultUserFilters() {
        const { q, device, blocked, admin, page } = this._userFilters;
        return !q && !device && !blocked && !admin && (page || 1) === 1;
    }

    // ─── Cycle de vie ────────────────────────────────────────────────

    async show() {
        // Réauthentification d'abord : l'habilitation est relue en base à chaque
        // appel, le cache local ne sert qu'à éviter d'afficher la page à tort.
        if (!await this._ensureAdmin()) {
            window.dispatchEvent(new CustomEvent('navigate-home'));
            return;
        }
        this.querySelector('#adminPage').style.display = 'block';
        document.body.style.overflow = 'hidden';
        // La console s'ouvre toujours sur l'accueil : le contenu d'une section
        // est redemandé à son ouverture, jamais au retour sur la page.
        this._loaded.clear();
        this._section = null;
        this._renderSection();
        await this.load();
    }

    hide() {
        const page = this.querySelector('#adminPage');
        if (page) page.style.display = 'none';
        document.body.style.overflow = '';
    }

    /** Résumés des tuiles, puis relecture de la section ouverte s'il y en a une. */
    async load() {
        await this._loadSummaries();
        if (this._section) await this._loadSection(this._section);
    }

    // ─── Sections ────────────────────────────────────────────────────

    /** Une tuile ouvre sa section : déjà chargée, elle ne relance aucune requête. */
    _openSection(key) {
        if (this._section === key) return;
        this._section = key;
        this._renderSection();
        if (this._loaded.has(key)) return;
        this._loaded.add(key);
        this._loadSection(key);
    }

    _closeSection() {
        this._section = null;
        this._renderSection();
    }

    /** L'accueil et la section ouverte s'excluent ; le header suit la section. */
    _renderSection() {
        const current = this._section;
        this.querySelectorAll('[data-admin-section]').forEach((card) => {
            card.hidden = card.dataset.adminSection !== current;
        });
        const tiles = this.querySelector('#adminTiles');
        if (tiles) tiles.hidden = !!current;

        const title = this.querySelector('#adminTitle');
        if (title) title.textContent = current ? SECTION_TITLES[current] : 'Administration';

        const back = this.querySelector('.admin-back');
        if (back) {
            const label = current ? 'Retour aux sections' : 'Retour';
            back.title = label;
            back.setAttribute('aria-label', label);
        }
        this.querySelector('.admin-page')?.scrollTo({ top: 0 });
    }

    /** Charge le contenu d'une section, en réutilisant le résumé quand il existe. */
    _loadSection(key) {
        switch (key) {
            case 'outbox':
                return this._loadOutbox(this._takePrefetch('outbox'));
            case 'engine':
                return Promise.all([
                    this._loadEngine(this._takePrefetch('engine')),
                    this._loadSettings(),
                    this._loadTargeting(),
                ]);
            case 'catalog':
                return this._loadCatalog(this._takePrefetch('catalog'));
            case 'campaigns':
                return this._loadCampaigns(this._takePrefetch('campaigns'));
            case 'users':
                return this._loadUserDirectory(this._takePrefetch('users'));
            default:
                return undefined;
        }
    }

    _tilesHtml() {
        return ADMIN_SECTIONS.map(({ key, icon, label, hint }) => `
            <button type="button" class="admin-tile" data-section="${key}">
                <i class="material-icons-round">${icon}</i>
                <span class="admin-tile-title">${escapeHtml(label)}</span>
                <span class="admin-tile-hint">${escapeHtml(hint)}</span>
                <span class="admin-tile-metric">…</span>
            </button>
        `).join('');
    }

    // ─── Résumés des tuiles ──────────────────────────────────────────

    /**
     * La seule passe systématique : de quoi remplir les tuiles. Chaque payload
     * est conservé pour la première ouverture de sa section, qui n'a donc rien
     * à redemander. Une tuile muette vaut mieux qu'une page en erreur.
     */
    async _loadSummaries() {
        this._summary = {};
        const [outbox, features, catalogs, campaigns, users] = await Promise.all([
            this._grab('outbox', () => api.getAdminOutbox()),
            this._grab('engine', () => api.getFeatures('notification')),
            this._grab('catalog', () => api.getAdminCatalog()),
            this._grab('campaigns', () => api.getAdminCampaigns()),
            this._grab('users', () => api.getAdminUsersDirectory({ page: 1 })),
        ]);

        const counts = outbox?.counts || {};
        const waiting = Number(counts.pending || 0);
        const failed = Number(counts.failed || 0);
        this._setTileMetric('outbox', !outbox
            ? 'Indisponible'
            : (waiting || failed
                ? `${formatCount(waiting)} en attente · ${formatCount(failed)} échec(s)`
                : 'Aucun envoi en attente'));

        // Un interrupteur absent du référentiel est considéré comme actif,
        // exactement comme le fait le moteur : le compte doit rester juste.
        const bySlug = {};
        (features?.features || []).forEach((feature) => { bySlug[feature.slug] = feature; });
        const active = ENGINE_SWITCHES
            .filter(({ slug }) => bySlug[slug]?.is_active !== false).length;
        this._setTileMetric('engine', features
            ? `${formatCount(active)}/${ENGINE_SWITCHES.length} interrupteurs actifs`
            : 'Indisponible');

        const catalogsCount = catalogs?.catalogs?.length;
        this._setTileMetric('catalog', catalogsCount === undefined
            ? 'Indisponible'
            : `${formatCount(catalogsCount)} référentiel(s)`);

        const list = campaigns?.campaigns || [];
        const running = list
            .filter(({ status }) => status === 'scheduled' || status === 'dispatching').length;
        this._setTileMetric('campaigns', !campaigns
            ? 'Indisponible'
            : (running ? `${formatCount(running)} en cours` : 'Aucune en cours'));

        this._setTileMetric('users', users
            ? `${formatCount(users.total ?? users.users?.length ?? 0)} compte(s)`
            : 'Indisponible');
    }

    /** Un résumé : la donnée est gardée pour la première ouverture de la section. */
    async _grab(key, request) {
        try {
            const data = await request();
            this._summary[key] = data;
            return data;
        } catch (err) {
            console.warn(`Résumé « ${key} » indisponible :`, err.message);
            return null;
        }
    }

    /** Un résumé ne sert qu'une fois : la section suivante le redemandera. */
    _takePrefetch(key) {
        const data = this._summary?.[key];
        if (data) delete this._summary[key];
        return data || null;
    }

    _setTileMetric(key, text) {
        const metric = this.querySelector(`.admin-tile[data-section="${key}"] .admin-tile-metric`);
        if (metric) metric.textContent = text;
    }

    async _ensureAdmin() {
        try {
            const me = await api.getMe();
            if (me?.is_admin) return true;
        } catch (err) {
            console.warn('Vérification de l’habilitation impossible :', err.message);
        }
        window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: 'Accès réservé à l’administration', type: 'error' },
        }));
        return false;
    }

    // ─── File d'envoi ────────────────────────────────────────────────

    async _loadOutbox() {
        const container = this.querySelector('#adminOutboxCounts');
        if (!container) return;
        try {
            const data = await api.getAdminOutbox();
            const counts = data?.counts || {};
            const order = ['pending', 'sent', 'failed', 'skipped'];
            const known = order
                .map((status) => this._chip(status, counts[status] || 0))
                .join('');
            const extra = Object.keys(counts)
                .filter((status) => !order.includes(status))
                .map((status) => this._chip(status, counts[status]))
                .join('');
            container.innerHTML = known + extra || '<span class="admin-placeholder">File vide</span>';
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    _chip(status, total) {
        const label = OUTBOX_STATUS_LABELS[status] || status;
        return `
            <span class="admin-chip ${escapeHtml(status)}">
                <b>${escapeHtml(String(total))}</b>
                <span>${escapeHtml(label)}</span>
            </span>
        `;
    }

    // ─── Interrupteurs ───────────────────────────────────────────────

    async _loadEngine(prefetched = null) {
        const container = this.querySelector('#adminEngineSwitches');
        if (!container) return;
        try {
            const data = prefetched || await api.getFeatures('notification');
            const bySlug = {};
            (data?.features || []).forEach((feature) => { bySlug[feature.slug] = feature; });

            container.innerHTML = ENGINE_SWITCHES.map(({ slug, label, hint, danger }) => {
                const feature = bySlug[slug];
                if (!feature) {
                    // Migration non appliquée : l'API considère l'interrupteur actif.
                    return `
                        <div class="admin-switch-row is-missing">
                            <span class="admin-switch-text">
                                <span class="admin-switch-label">${escapeHtml(label)}</span>
                                <span class="admin-switch-hint">
                                    Interrupteur absent du référentiel — considéré comme actif.
                                </span>
                            </span>
                        </div>
                    `;
                }
                const active = feature.is_active !== false;
                return `
                    <label class="admin-switch-row ${danger ? 'is-danger' : ''}">
                        <span class="admin-switch-text">
                            <span class="admin-switch-label">${escapeHtml(feature.label || label)}</span>
                            <span class="admin-switch-hint">${escapeHtml(feature.description || hint)}</span>
                        </span>
                        <input type="checkbox" class="admin-switch-input"
                               data-slug="${escapeHtml(slug)}" ${active ? 'checked' : ''}>
                        <span class="admin-switch-track"><span class="admin-switch-thumb"></span></span>
                    </label>
                `;
            }).join('');

            container.querySelectorAll('.admin-switch-input').forEach((input) => {
                input.addEventListener('change', () => this._toggleFeature(input));
            });
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    async _toggleFeature(input) {
        const slug = input.dataset.slug;
        const wanted = input.checked;
        input.disabled = true;
        try {
            const feature = await api.setFeatureActive(slug, wanted);
            this._toast(`${feature?.label || slug} : ${feature?.is_active ? 'activé' : 'désactivé'}`);
            // Le cache des interrupteurs front doit suivre, sinon un écran
            // continuerait d'afficher des fonctions que l'on vient de couper.
            import('../../utils/featureFlags.js')
                .then(({ clearFeatureCache, preloadFeatureFlags }) => {
                    clearFeatureCache();
                    return preloadFeatureFlags();
                })
                .catch(() => {});
        } catch (err) {
            input.checked = !wanted;
            this._toast(err.message, 'error');
        } finally {
            input.disabled = false;
        }
    }

    // ─── Fenêtre d'envoi (MNO-15) ────────────────────────────────────

    async _loadSettings() {
        const container = this.querySelector('#adminSettings');
        if (!container) return;
        try {
            const data = await api.getAdminSettings();
            this._settings = data?.settings || [];
            this._renderSettings();
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    _renderSettings() {
        const container = this.querySelector('#adminSettings');
        if (!container) return;
        const settings = this._settings || [];
        if (!settings.length) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = `
            <h4 class="admin-section-title">Fenêtre d’envoi</h4>
            <p class="admin-card-hint">
                Les envois non critiques ne partent qu’entre l’ouverture et la
                fermeture, heure locale. Hors fenêtre, ils sont reportés à la
                prochaine ouverture.
            </p>
            ${settings.map((setting) => this._settingRow(setting)).join('')}
            <button type="button" class="admin-settings-save" id="adminSettingsSave">
                <i class="material-icons-round">save</i> Enregistrer la fenêtre
            </button>
        `;

        container.querySelector('#adminSettingsSave')
            ?.addEventListener('click', () => this._saveSettings());
        container.querySelectorAll('.admin-day').forEach((button) => {
            button.addEventListener('click', () => {
                const on = button.classList.toggle('is-on');
                button.setAttribute('aria-pressed', String(on));
            });
        });
    }

    /** Une ligne de réglage : le contrôle dépend du type déclaré par le back. */
    _settingRow({ key, label, kind, hint, value }) {
        const id = `adminSetting-${String(key).replace(/[^a-zA-Z0-9-]/g, '-')}`;
        const isDays = kind === 'weekdays';
        let control;

        if (isDays) {
            const days = new Set((Array.isArray(value) ? value : []).map(Number));
            control = `<div class="admin-days">${WEEKDAY_LABELS.map((dayLabel, index) => `
                <button type="button" class="admin-day ${days.has(index) ? 'is-on' : ''}"
                        data-key="${escapeHtml(key)}" data-day="${index}"
                        aria-pressed="${days.has(index)}">${escapeHtml(dayLabel)}</button>
            `).join('')}</div>`;
        } else if (kind === 'int') {
            control = `<input class="form-input admin-setting-input" id="${id}"
                              type="number" min="0" inputmode="numeric"
                              data-key="${escapeHtml(key)}" data-kind="int"
                              value="${escapeHtml(String(value ?? 0))}">`;
        } else {
            control = `<input class="form-input admin-setting-input" id="${id}"
                              type="time" data-key="${escapeHtml(key)}" data-kind="hhmm"
                              value="${escapeHtml(String(value || ''))}">`;
        }

        const text = `<${isDays ? 'div' : 'label'} class="admin-setting-text"${isDays ? '' : ` for="${id}"`}>
                <span class="admin-setting-label">${escapeHtml(label)}</span>
                <span class="admin-setting-hint">${escapeHtml(hint || '')}</span>
            </${isDays ? 'div' : 'label'}>`;

        return `<div class="admin-setting-row">${text}${control}</div>`;
    }

    async _saveSettings() {
        const container = this.querySelector('#adminSettings');
        if (!container) return;

        const values = {};
        container.querySelectorAll('.admin-setting-input').forEach((input) => {
            values[input.dataset.key] = input.dataset.kind === 'int'
                ? Number(input.value || 0)
                : input.value;
        });
        container.querySelectorAll('.admin-day').forEach((day) => {
            const key = day.dataset.key;
            if (!values[key]) values[key] = [];
            if (day.classList.contains('is-on')) values[key].push(Number(day.dataset.day));
        });

        const button = container.querySelector('#adminSettingsSave');
        if (button) button.disabled = true;
        try {
            const data = await api.setAdminSettings(values);
            this._settings = data?.settings || this._settings;
            this._renderSettings();
            this._toast('Fenêtre d’envoi mise à jour');
        } catch (err) {
            this._toast(err.message, 'error');
            if (button) button.disabled = false;
        }
    }

    // ─── Ciblage ─────────────────────────────────────────────────────

    async _loadTargeting() {
        const container = this.querySelector('#adminTargeting');
        if (!container) return;
        try {
            const data = await api.getAdminTargeting();
            const current = data?.mode;
            const options = data?.options || [];
            if (!options.length) {
                container.innerHTML = '<span class="admin-placeholder">Aucun mode disponible</span>';
                return;
            }
            container.innerHTML = options.map((option) => `
                <button type="button" class="admin-radio ${option.slug === current ? 'is-active' : ''}"
                        data-mode="${escapeHtml(option.slug)}"
                        aria-pressed="${option.slug === current}">
                    <span class="admin-radio-dot"></span>
                    <span class="admin-radio-text">
                        <span class="admin-radio-label">${escapeHtml(option.label)}</span>
                        <span class="admin-radio-hint">${escapeHtml(option.description || '')}</span>
                    </span>
                </button>
            `).join('');

            container.querySelectorAll('.admin-radio').forEach((button) => {
                button.addEventListener('click', () => this._selectTargeting(button));
            });
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    async _selectTargeting(button) {
        const mode = button.dataset.mode;
        if (button.classList.contains('is-active')) return;
        button.disabled = true;
        try {
            const data = await api.setAdminTargeting(mode);
            this._toast('Mode de ciblage mis à jour');
            this._applyTargeting(data);
        } catch (err) {
            this._toast(err.message, 'error');
        } finally {
            button.disabled = false;
        }
    }

    _applyTargeting(data) {
        const current = data?.mode;
        this.querySelectorAll('.admin-radio').forEach((button) => {
            const active = button.dataset.mode === current;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    // ─── Référentiels (MNO-17) ───────────────────────────────────────

    async _loadCatalog() {
        const tabs = this.querySelector('#adminCatalogTabs');
        const body = this.querySelector('#adminCatalogBody');
        if (!tabs || !body) return;

        try {
            const data = await api.getAdminCatalog();
            this._catalogs = data?.catalogs || [];
            if (!this._catalogs.length) {
                tabs.innerHTML = '';
                body.innerHTML = this._message('Aucun référentiel administrable.');
                return;
            }

            tabs.innerHTML = this._catalogs.map((catalog) => `
                <button type="button" class="admin-tab" data-catalog="${escapeHtml(catalog.key)}">
                    ${escapeHtml(catalog.label)}
                </button>
            `).join('');
            tabs.querySelectorAll('.admin-tab').forEach((tab) => {
                tab.addEventListener('click', () => this._selectCatalog(tab.dataset.catalog));
            });

            // On revient sur l'onglet déjà ouvert : actualiser ne doit pas
            // ramener l'exploitant au premier référentiel.
            const wanted = this._catalogs.some((catalog) => catalog.key === this._catalogKey)
                ? this._catalogKey
                : this._catalogs[0].key;
            await this._selectCatalog(wanted);
        } catch (err) {
            tabs.innerHTML = '';
            body.innerHTML = this._error(err);
        }
    }

    async _selectCatalog(key) {
        const tabs = this.querySelector('#adminCatalogTabs');
        const body = this.querySelector('#adminCatalogBody');
        if (!tabs || !body) return;

        this._catalogKey = key;
        tabs.querySelectorAll('.admin-tab').forEach((tab) => {
            tab.classList.toggle('is-active', tab.dataset.catalog === key);
        });
        body.innerHTML = '<span class="admin-placeholder">Chargement…</span>';

        try {
            const data = await api.getAdminCatalogEntries(key);
            const entries = data?.entries || [];
            body.innerHTML = `
                ${data?.hint ? `<p class="admin-card-hint">${escapeHtml(data.hint)}</p>` : ''}
                ${entries.length
                    ? entries.map((entry) => this._catalogEntry(data, entry)).join('')
                    : this._message('Aucune entrée dans ce référentiel.')}
            `;
            body.querySelectorAll('.admin-catalog-entry').forEach((row) => {
                row.querySelector('.admin-catalog-save')
                    ?.addEventListener('click', () => this._saveCatalogEntry(row));
                row.querySelector('.admin-catalog-active')
                    ?.addEventListener('change', (event) => this._toggleCatalogEntry(row, event.target));
            });
        } catch (err) {
            body.innerHTML = this._error(err);
        }
    }

    /** Une entrée : sa clé, son interrupteur d'activation, puis ses champs éditables. */
    _catalogEntry(data, entry) {
        const fields = data.fields || [];
        const entryKey = (data.key_columns || []).map((column) => entry[column]).join('/');
        const active = entry.is_active !== false;
        const hasActiveField = fields.some((field) => field.name === 'is_active');

        return `
            <div class="admin-catalog-entry ${active ? '' : 'is-inactive'}"
                 data-entry-key="${escapeHtml(entryKey)}">
                <div class="admin-catalog-head">
                    <span class="admin-catalog-key">${escapeHtml(entryKey)}</span>
                    ${hasActiveField ? `
                        <label class="admin-switch-row admin-catalog-toggle">
                            <input type="checkbox" class="admin-switch-input admin-catalog-active"
                                   ${active ? 'checked' : ''}>
                            <span class="admin-switch-track"><span class="admin-switch-thumb"></span></span>
                        </label>
                    ` : ''}
                </div>
                ${fields
                    .filter((field) => field.name !== 'is_active')
                    .map((field) => this._catalogField(field, entry))
                    .join('')}
                <button type="button" class="admin-settings-save admin-catalog-save">
                    <i class="material-icons-round">save</i> Enregistrer
                </button>
            </div>
        `;
    }

    _catalogField(field, entry) {
        const raw = entry[field.name];
        const value = raw === null || raw === undefined ? '' : String(raw);
        const numeric = field.kind === 'int' || field.kind === 'decimal';
        const input = numeric
            ? `<input class="form-input admin-setting-input" type="number" min="0"
                      step="${field.kind === 'decimal' ? '0.01' : '1'}" inputmode="decimal"
                      data-kind="${escapeHtml(field.kind)}" data-field="${escapeHtml(field.name)}"
                      value="${escapeHtml(value)}">`
            : `<input class="form-input admin-setting-input admin-catalog-text" type="text"
                      data-kind="${escapeHtml(field.kind)}" data-field="${escapeHtml(field.name)}"
                      value="${escapeHtml(value)}">`;

        return `
            <div class="admin-setting-row">
                <div class="admin-setting-text">
                    <span class="admin-setting-label">${escapeHtml(field.label)}</span>
                    ${field.hint ? `<span class="admin-setting-hint">${escapeHtml(field.hint)}</span>` : ''}
                </div>
                ${input}
            </div>
        `;
    }

    async _saveCatalogEntry(row) {
        const values = {};
        row.querySelectorAll('[data-field]').forEach((input) => {
            const kind = input.dataset.kind;
            values[input.dataset.field] = kind === 'int' || kind === 'decimal'
                ? Number(input.value || 0)
                : input.value;
        });

        const button = row.querySelector('.admin-catalog-save');
        if (button) button.disabled = true;
        try {
            await api.updateAdminCatalogEntry(this._catalogKey, row.dataset.entryKey, values);
            this._toast('Référentiel mis à jour');
        } catch (err) {
            this._toast(err.message, 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    /** L'activation est l'action la plus fréquente : elle part sans confirmation. */
    async _toggleCatalogEntry(row, input) {
        const wanted = input.checked;
        input.disabled = true;
        try {
            await api.updateAdminCatalogEntry(
                this._catalogKey, row.dataset.entryKey, { is_active: wanted });
            row.classList.toggle('is-inactive', !wanted);
            this._toast(wanted ? 'Entrée activée' : 'Entrée désactivée');
        } catch (err) {
            input.checked = !wanted;
            this._toast(err.message, 'error');
        } finally {
            input.disabled = false;
        }
    }

    // ─── Campagnes (MNO-18) ──────────────────────────────────────────

    async _loadCampaigns(prefetched = null) {
        const list = this.querySelector('#adminCampaignList');
        if (!list) return;
        try {
            const data = prefetched || await api.getAdminCampaigns();
            this._campaignOptions = data?.options || { channels: [], audience_modes: [] };
            this._renderCampaignChannels();
            this._renderCampaignAudience();
            this._renderCampaignPicked();
            this._renderCampaignList(data?.campaigns || []);
        } catch (err) {
            list.innerHTML = this._error(err);
        }
    }

    /** Le canal est un choix du registre : la console affiche ce que le back accepte. */
    _renderCampaignChannels() {
        const select = this.querySelector('#adminCampaignChannel');
        if (!select) return;
        const channels = this._campaignOptions.channels || [];
        const previous = select.value;
        select.innerHTML = channels.map((channel) => `
            <option value="${escapeHtml(channel)}">${escapeHtml(CHANNEL_LABELS[channel] || channel)}</option>
        `).join('');
        if (previous && channels.includes(previous)) select.value = previous;
    }

    _renderCampaignAudience() {
        const container = this.querySelector('#adminCampaignAudience');
        if (!container) return;
        const modes = this._campaignOptions.audience_modes?.length
            ? this._campaignOptions.audience_modes
            : Object.keys(AUDIENCE_LABELS);

        container.innerHTML = modes.map((mode) => `
            <button type="button" class="admin-radio ${mode === this._campaignAudience ? 'is-active' : ''}"
                    data-audience="${escapeHtml(mode)}"
                    aria-pressed="${mode === this._campaignAudience}">
                <span class="admin-radio-dot"></span>
                <span class="admin-radio-text">
                    <span class="admin-radio-label">${escapeHtml(AUDIENCE_LABELS[mode] || mode)}</span>
                    <span class="admin-radio-hint">${escapeHtml(AUDIENCE_HINTS[mode] || '')}</span>
                </span>
            </button>
        `).join('');

        container.querySelectorAll('.admin-radio').forEach((button) => {
            button.addEventListener('click', () => this._selectCampaignAudience(button.dataset.audience));
        });
        this._applyCampaignAudience();
    }

    _selectCampaignAudience(mode) {
        if (mode === this._campaignAudience) return;
        this._campaignAudience = mode;
        this._applyCampaignAudience();
    }

    _applyCampaignAudience() {
        this.querySelectorAll('#adminCampaignAudience .admin-radio').forEach((button) => {
            const active = button.dataset.audience === this._campaignAudience;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const selection = this.querySelector('#adminCampaignSelection');
        if (selection) selection.hidden = this._campaignAudience !== 'selected';
    }

    // ── Sélection des destinataires ──

    async _searchCampaignUsers() {
        const input = this.querySelector('#adminCampaignSearchInput');
        const container = this.querySelector('#adminCampaignSearchResults');
        if (!container) return;
        const query = input?.value.trim() || '';

        if (query.length < 2) {
            container.innerHTML = this._message('Saisissez au moins deux caractères.', 'error');
            return;
        }

        container.innerHTML = '<span class="admin-placeholder">Recherche…</span>';
        try {
            this._campaignResults = await api.searchAdminUsers(query) || [];
            if (!this._campaignResults.length) {
                container.innerHTML = this._message('Aucun compte trouvé.');
                return;
            }
            container.innerHTML = this._campaignResults.map((user) => {
                const picked = this._campaignPicked.has(String(user.id));
                return `
                    <label class="admin-user-row ${picked ? 'is-selected' : ''}"
                           data-user-id="${escapeHtml(String(user.id))}">
                        <img src="${escapeHtml(resolveImageUrl(user.avatar_url) || DEFAULT_AVATAR_PATH)}"
                             alt="" class="admin-user-avatar">
                        <span class="admin-user-text">
                            <span class="admin-user-pseudo">${escapeHtml(user.pseudo || '—')}</span>
                            <span class="admin-user-phone">${escapeHtml(user.phone || 'sans téléphone')}</span>
                        </span>
                        <input type="checkbox" class="admin-campaign-pick" ${picked ? 'checked' : ''}>
                    </label>
                `;
            }).join('');

            container.querySelectorAll('.admin-campaign-pick').forEach((checkbox) => {
                checkbox.addEventListener('change', () => {
                    const row = checkbox.closest('.admin-user-row');
                    row.classList.toggle('is-selected', checkbox.checked);
                    this._pickCampaignUser(row.dataset.userId, checkbox.checked);
                });
            });
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    _pickCampaignUser(userId, picked) {
        if (picked) {
            const user = (this._campaignResults || [])
                .find((item) => String(item.id) === String(userId));
            if (user) this._campaignPicked.set(String(userId), user);
        } else {
            this._campaignPicked.delete(String(userId));
        }
        this._renderCampaignPicked();
    }

    _renderCampaignPicked() {
        const container = this.querySelector('#adminCampaignPicked');
        if (!container) return;
        const users = [...this._campaignPicked.values()];
        if (!users.length) {
            container.innerHTML = '<span class="admin-placeholder">Aucun compte sélectionné</span>';
            return;
        }

        container.innerHTML = users.map((user) => `
            <button type="button" class="admin-chip admin-campaign-picked"
                    data-user-id="${escapeHtml(String(user.id))}" title="Retirer">
                <b>${escapeHtml(user.pseudo || user.phone || '—')}</b>
                <i class="material-icons-round">close</i>
            </button>
        `).join('');

        container.querySelectorAll('.admin-campaign-picked').forEach((chip) => {
            chip.addEventListener('click', () => {
                this._campaignPicked.delete(chip.dataset.userId);
                this._renderCampaignPicked();
                this.querySelectorAll('#adminCampaignSearchResults .admin-user-row').forEach((row) => {
                    if (row.dataset.userId !== chip.dataset.userId) return;
                    row.classList.remove('is-selected');
                    const box = row.querySelector('.admin-campaign-pick');
                    if (box) box.checked = false;
                });
            });
        });
    }

    _campaignAudiencePayload() {
        return {
            audience_mode: this._campaignAudience,
            user_ids: this._campaignAudience === 'selected' ? [...this._campaignPicked.keys()] : [],
        };
    }

    // ── Aperçu, validation, annulation ──

    async _previewCampaign() {
        const feedback = this.querySelector('#adminCampaignFeedback');
        if (!feedback) return;
        const audience = this._campaignAudiencePayload();

        if (audience.audience_mode === 'selected' && !audience.user_ids.length) {
            feedback.innerHTML = this._message('Sélectionnez au moins un compte.', 'error');
            return;
        }

        feedback.innerHTML = '<span class="admin-placeholder">Aperçu…</span>';
        try {
            const data = await api.previewAdminCampaign(audience);
            feedback.innerHTML = this._message(
                `${data.users} compte(s) visé(s), dont ${data.reachable} joignable(s) par push.`, 'ok');
        } catch (err) {
            feedback.innerHTML = this._error(err);
        }
    }

    async _submitCampaign() {
        const feedback = this.querySelector('#adminCampaignFeedback');
        const button = this.querySelector('#adminCampaignSubmit');
        const title = this.querySelector('#adminCampaignTitle')?.value.trim() || '';
        const body = this.querySelector('#adminCampaignBody')?.value.trim() || '';
        const channel = this.querySelector('#adminCampaignChannel')?.value || '';
        const when = this.querySelector('#adminCampaignWhen')?.value || '';
        const audience = this._campaignAudiencePayload();

        if (!title || !body) {
            if (feedback) feedback.innerHTML = this._message('Un titre et un message sont nécessaires.', 'error');
            return;
        }
        if (audience.audience_mode === 'selected' && !audience.user_ids.length) {
            if (feedback) feedback.innerHTML = this._message('Sélectionnez au moins un compte.', 'error');
            return;
        }

        if (button) button.disabled = true;
        if (feedback) feedback.innerHTML = '<span class="admin-placeholder">Validation…</span>';
        try {
            // Une heure locale est convertie en instant : le serveur lit ensuite
            // un moment absolu, sans dépendre du fuseau du navigateur.
            const campaign = await api.createAdminCampaign({
                title,
                body,
                channel,
                audience_mode: audience.audience_mode,
                user_ids: audience.user_ids,
                scheduled_at: when ? new Date(when).toISOString() : null,
            });
            if (feedback) feedback.innerHTML = this._message(this._campaignOutcome(campaign), 'ok');
            this._resetCampaignForm();
            await this._loadCampaigns();
        } catch (err) {
            if (feedback) feedback.innerHTML = this._error(err);
        } finally {
            if (button) button.disabled = false;
        }
    }

    _campaignOutcome(campaign) {
        if (campaign?.status === 'dispatched') {
            return 'Campagne remise à la file d’envoi : la livraison suit la politique de chaque compte.';
        }
        if (campaign?.status === 'scheduled') {
            return `Campagne programmée pour le ${formatDateTime(campaign.scheduled_at)}.`;
        }
        return `Campagne enregistrée (${CAMPAIGN_STATUS_LABELS[campaign?.status] || campaign?.status}).`;
    }

    _resetCampaignForm() {
        const title = this.querySelector('#adminCampaignTitle');
        const body = this.querySelector('#adminCampaignBody');
        const when = this.querySelector('#adminCampaignWhen');
        const input = this.querySelector('#adminCampaignSearchInput');
        const results = this.querySelector('#adminCampaignSearchResults');
        if (title) title.value = '';
        if (body) body.value = '';
        if (when) when.value = '';
        if (input) input.value = '';
        if (results) results.innerHTML = '';
        this._campaignPicked.clear();
        this._campaignResults = [];
        this._campaignAudience = 'all';
        this._applyCampaignAudience();
        this._renderCampaignPicked();
    }

    _renderCampaignList(campaigns) {
        const container = this.querySelector('#adminCampaignList');
        if (!container) return;
        if (!campaigns.length) {
            container.innerHTML = this._message('Aucune campagne enregistrée.');
            return;
        }
        container.innerHTML = campaigns.map((campaign) => this._campaignItem(campaign)).join('');
        container.querySelectorAll('.admin-campaign-cancel').forEach((button) => {
            button.addEventListener('click', () => this._cancelCampaign(button.dataset.campaignId));
        });
    }

    /** Une campagne : son état réel, son audience figée et l'avancement de ses envois. */
    _campaignItem(campaign) {
        const status = campaign.status;
        const color = CAMPAIGN_STATUS_COLORS[status] || 'var(--text-muted)';
        const label = CAMPAIGN_STATUS_LABELS[status] || status;
        const counts = campaign.outbox_counts || {};
        const queue = Object.keys(counts)
            .map((key) => `${counts[key]} ${(OUTBOX_STATUS_LABELS[key] || key).toLowerCase()}`)
            .join(' · ');

        return `
            <div class="admin-campaign-item">
                <div class="admin-journal-head">
                    <span class="admin-journal-type">${escapeHtml(campaign.title || '—')}</span>
                    <span class="admin-badge" style="color:${color};border-color:${color};">
                        ${escapeHtml(label)}
                    </span>
                </div>
                <div class="admin-journal-meta">
                    ${escapeHtml(AUDIENCE_LABELS[campaign.audience_mode] || campaign.audience_mode || '—')}
                    · ${escapeHtml(String(campaign.audience_count ?? 0))} compte(s)
                    · ${escapeHtml(String(campaign.reachable_count ?? 0))} joignable(s)
                    · ${escapeHtml(formatDateTime(campaign.scheduled_at))}
                </div>
                <p class="admin-campaign-message">${escapeHtml(campaign.body || '')}</p>
                ${queue ? `<div class="admin-journal-meta">${escapeHtml(queue)}</div>` : ''}
                ${campaign.last_reason ? `
                    <div class="admin-journal-error">
                        ${escapeHtml(CAMPAIGN_REASON_LABELS[campaign.last_reason] || campaign.last_reason)}
                    </div>
                ` : ''}
                ${status === 'scheduled' ? `
                    <button type="button" class="admin-campaign-cancel"
                            data-campaign-id="${escapeHtml(String(campaign.id))}">
                        <i class="material-icons-round">cancel</i> Annuler
                    </button>
                ` : ''}
            </div>
        `;
    }

    async _cancelCampaign(campaignId) {
        try {
            await api.cancelAdminCampaign(campaignId);
            this._toast('Campagne annulée');
        } catch (err) {
            this._toast(err.message, 'error');
        }
        // Relecture dans tous les cas : l'annulation a pu être refusée parce que
        // la campagne venait de partir, et la liste doit le montrer.
        await this._loadCampaigns();
    }

    // ─── Suivi et gestion des comptes (MNO-19) ───────────────────────

    async _loadUserDirectory(prefetched = null) {
        const container = this.querySelector('#adminUserList');
        if (!container) return;
        this._renderUserFilters();

        const filters = this._userFilters;
        // Le résumé de la tuile porte la première page sans filtre : il ne vaut
        // que tant que l'exploitant n'a pas restreint la liste.
        const reuse = !!prefetched && this._isDefaultUserFilters();
        if (!reuse) {
            container.innerHTML = '<span class="admin-placeholder">Chargement…</span>';
            const pager = this.querySelector('#adminUserPager');
            if (pager) pager.innerHTML = '';
        }

        try {
            const data = reuse ? prefetched : await api.getAdminUsersDirectory({
                q: filters.q,
                device: filters.device,
                // Une case décochée veut dire « tous les comptes », pas « ceux qui
                // ne le sont pas » : le filtre ne part que s'il restreint.
                blocked: filters.blocked ? true : undefined,
                admin: filters.admin ? true : undefined,
                page: filters.page,
            });
            // Le serveur borne la page : on retient celle qu'il a réellement servie.
            this._userFilters.page = data.page;
            this._renderUserList(data);
            this._renderUserPager(data);
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    _renderUserList(data) {
        const container = this.querySelector('#adminUserList');
        if (!container) return;
        const users = data.users || [];
        if (!users.length) {
            container.innerHTML = this._message('Aucun compte ne correspond à ces filtres.');
            return;
        }

        container.innerHTML = `
            <div class="admin-user-total">${escapeHtml(String(data.total ?? users.length))} compte(s)</div>
            ${users.map((user) => this._userItem(user)).join('')}
        `;

        container.querySelectorAll('.admin-user-entry').forEach((entry) => {
            const userId = entry.dataset.userId;
            const form = entry.querySelector('.admin-user-block-form');
            entry.querySelector('.admin-user-block')?.addEventListener('click', () => {
                if (!form) return;
                form.hidden = false;
                form.querySelector('input')?.focus();
            });
            entry.querySelector('.admin-user-cancel')?.addEventListener('click', () => {
                if (!form) return;
                form.hidden = true;
                const reason = form.querySelector('input');
                if (reason) reason.value = '';
            });
            form?.addEventListener('submit', (event) => {
                event.preventDefault();
                this._blockUser(userId, form.querySelector('input')?.value.trim() || '');
            });
            entry.querySelector('.admin-user-unblock')
                ?.addEventListener('click', () => this._unblockUser(userId));
        });
    }

    /** Une ligne de compte : son état, ses appareils et la décision qu'on peut prendre. */
    _userItem(user) {
        const blocked = !!user.is_blocked;
        const facts = [
            `${user.reachable_count ?? 0}/${user.device_count ?? 0} appareil(s) joignable(s)`,
            `inscrit le ${formatDateTime(user.created_at)}`,
        ];
        if (user.is_admin) facts.push('administrateur');

        return `
            <div class="admin-user-entry ${blocked ? 'is-blocked' : ''}"
                 data-user-id="${escapeHtml(String(user.id))}">
                <img src="${escapeHtml(resolveImageUrl(user.avatar_url) || DEFAULT_AVATAR_PATH)}"
                     alt="" class="admin-user-avatar">
                <div class="admin-user-text">
                    <span class="admin-user-pseudo">${escapeHtml(user.pseudo || '—')}</span>
                    <span class="admin-user-phone">${escapeHtml(user.phone || 'sans téléphone')}</span>
                    <span class="admin-user-meta">${escapeHtml(facts.join(' · '))}</span>
                    ${blocked ? `
                        <span class="admin-user-blocked-reason">
                            ${escapeHtml(user.blocked_reason || 'Compte bloqué')}
                            ${user.blocked_at ? ` — ${escapeHtml(formatDateTime(user.blocked_at))}` : ''}
                        </span>
                    ` : ''}
                </div>
                ${user.is_admin ? '' : (blocked
                    ? `<button type="button" class="admin-user-btn admin-user-unblock">
                           <i class="material-icons-round">lock_open</i> Débloquer
                       </button>`
                    : `<button type="button" class="admin-user-btn admin-user-block">
                           <i class="material-icons-round">block</i> Bloquer
                       </button>`)}
                <form class="admin-user-block-form" hidden>
                    <input class="form-input" type="text" maxlength="300"
                           placeholder="Motif du blocage (facultatif)">
                    <button type="submit" class="admin-user-btn is-danger">Confirmer</button>
                    <button type="button" class="admin-user-btn admin-user-cancel">Annuler</button>
                </form>
            </div>
        `;
    }

    _renderUserPager(data) {
        const container = this.querySelector('#adminUserPager');
        if (!container) return;
        if (!data.pages || data.pages <= 1) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = `
            <button type="button" class="admin-page-btn" id="adminUserPrev"
                    ${data.page <= 1 ? 'disabled' : ''} aria-label="Page précédente">
                <i class="material-icons-round">chevron_left</i>
            </button>
            <span class="admin-page-label">
                Page ${escapeHtml(String(data.page))} sur ${escapeHtml(String(data.pages))}
            </span>
            <button type="button" class="admin-page-btn" id="adminUserNext"
                    ${data.page >= data.pages ? 'disabled' : ''} aria-label="Page suivante">
                <i class="material-icons-round">chevron_right</i>
            </button>
        `;
        container.querySelector('#adminUserPrev')
            ?.addEventListener('click', () => this._goToUserPage(data.page - 1));
        container.querySelector('#adminUserNext')
            ?.addEventListener('click', () => this._goToUserPage(data.page + 1));
    }

    _goToUserPage(page) {
        this._userFilters.page = Math.max(1, page);
        this._loadUserDirectory();
    }

    async _blockUser(userId, reason) {
        try {
            await api.blockAdminUser(userId, reason || null);
            this._toast('Compte bloqué');
        } catch (err) {
            this._toast(err.message, 'error');
        }
        // Relecture dans tous les cas : un refus (compte administrateur) doit se
        // voir dans la liste plutôt que de laisser croire au succès.
        await this._loadUserDirectory();
    }

    async _unblockUser(userId) {
        try {
            await api.unblockAdminUser(userId);
            this._toast('Compte débloqué');
        } catch (err) {
            this._toast(err.message, 'error');
        }
        await this._loadUserDirectory();
    }

    // ─── Comptes : recherche, journal, diagnostic, test ──────────────

    async _search() {
        const input = this.querySelector('#adminSearchInput');
        const container = this.querySelector('#adminSearchResults');
        const panel = this.querySelector('#adminUserPanel');
        const query = input?.value.trim() || '';

        if (query.length < 2) {
            container.innerHTML = this._message('Saisissez au moins deux caractères.', 'error');
            return;
        }

        container.innerHTML = '<span class="admin-placeholder">Recherche…</span>';
        panel.innerHTML = '';
        this._user = null;

        try {
            this._searchResults = await api.searchAdminUsers(query) || [];
            if (!this._searchResults.length) {
                container.innerHTML = this._message('Aucun compte trouvé.');
                return;
            }
            container.innerHTML = this._searchResults.map((user) => `
                <button type="button" class="admin-user-row" data-user-id="${escapeHtml(String(user.id))}">
                    <img src="${escapeHtml(resolveImageUrl(user.avatar_url) || DEFAULT_AVATAR_PATH)}"
                         alt="" class="admin-user-avatar">
                    <span class="admin-user-text">
                        <span class="admin-user-pseudo">${escapeHtml(user.pseudo || '—')}</span>
                        <span class="admin-user-phone">${escapeHtml(user.phone || 'sans téléphone')}</span>
                    </span>
                    <i class="material-icons-round admin-user-arrow">chevron_right</i>
                </button>
            `).join('');

            container.querySelectorAll('.admin-user-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const user = this._searchResults.find(
                        (item) => String(item.id) === row.dataset.userId,
                    );
                    if (user) this._openUser(user);
                });
            });
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    async _openUser(user) {
        this._user = user;
        this.querySelectorAll('.admin-user-row').forEach((row) => {
            row.classList.toggle('is-selected', row.dataset.userId === String(user.id));
        });

        const panel = this.querySelector('#adminUserPanel');
        panel.innerHTML = `
            <div class="admin-user-head">
                <div>
                    <strong>${escapeHtml(user.pseudo || '—')}</strong>
                    <small>${escapeHtml(user.phone || 'sans téléphone')}</small>
                </div>
                <button type="button" class="admin-test-btn" id="adminTestBtn">
                    <i class="material-icons-round">send</i> Envoyer un test
                </button>
            </div>
            <div id="adminTestResult"></div>
            <div id="adminDiagnostic"><span class="admin-placeholder">Chargement du diagnostic…</span></div>
            <div id="adminJournal"><span class="admin-placeholder">Chargement du journal…</span></div>
        `;

        panel.querySelector('#adminTestBtn')?.addEventListener('click', () => this._sendTest(user.id));

        await Promise.all([
            this._loadDiagnostic(user.id),
            this._loadJournal(user.id),
        ]);
    }

    async _loadDiagnostic(userId) {
        const container = this.querySelector('#adminDiagnostic');
        if (!container) return;
        try {
            const report = await api.getAdminUserDiagnostic(userId);
            const findings = report?.findings || [];
            const devices = report?.devices || {};
            const sendWindow = report?.window || {};
            const cap = report?.daily_cap || {};

            container.innerHTML = `
                <h4 class="admin-section-title">Diagnostic</h4>
                ${findings.length
                    ? `<div class="admin-findings">${findings.map((finding) => `
                        <div class="admin-finding">
                            ${severityBadge(finding.severity)}
                            <div>
                                <strong>${escapeHtml(finding.label)}</strong>
                                <p>${escapeHtml(finding.detail)}</p>
                            </div>
                        </div>
                    `).join('')}</div>`
                    : this._message('Aucune cause identifiée : ce compte est joignable.', 'ok')}
                <dl class="admin-facts">
                    <div><dt>Moteur</dt><dd>${report?.engine?.enabled ? 'actif' : 'arrêté'}
                        — ciblage « ${escapeHtml(report?.engine?.targeting_mode || '—')} »</dd></div>
                    <div><dt>Appareils</dt><dd>${escapeHtml(String(devices.reachable ?? 0))} joignable(s)
                        sur ${escapeHtml(String(devices.total ?? 0))}</dd></div>
                    <div><dt>Fenêtre</dt><dd>${sendWindow.enabled === false
                        ? 'interrupteur coupé'
                        : `${escapeHtml(sendWindow.opening || '')} – ${escapeHtml(sendWindow.close || '')}${sendWindow.closed
                            ? ` — hors fenêtre, reprise ${escapeHtml(formatDateTime(sendWindow.resumes_at))}` : ''}`}</dd></div>
                    <div><dt>Plafond</dt><dd>${cap.enabled === false
                        ? 'interrupteur coupé'
                        : `${escapeHtml(String(cap.used ?? 0))} / ${escapeHtml(String(cap.limit ?? 0))}${cap.reached ? ' — atteint' : ''}`}</dd></div>
                </dl>
            `;
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    async _loadJournal(userId) {
        const container = this.querySelector('#adminJournal');
        if (!container) return;
        try {
            const data = await api.getAdminUserJournal(userId);
            const deliveries = data?.deliveries || [];
            const queued = data?.queued || [];

            container.innerHTML = `
                <h4 class="admin-section-title">Journal des envois</h4>
                ${deliveries.length ? deliveries.map((row) => {
                    const color = DELIVERY_STATUS_COLORS[row.status] || 'var(--text-muted)';
                    const label = DELIVERY_STATUS_LABELS[row.status] || row.status;
                    return `
                        <div class="admin-journal-row">
                            <div class="admin-journal-head">
                                <span class="admin-journal-type">${escapeHtml(row.event_type || '—')}</span>
                                <span class="admin-badge" style="color:${color};border-color:${color};">
                                    ${escapeHtml(label)}
                                </span>
                            </div>
                            <div class="admin-journal-meta">
                                ${escapeHtml(formatDateTime(row.created_at))}
                                · ${escapeHtml(String(row.success_count ?? 0))}/${escapeHtml(String(row.token_count ?? 0))} appareil(s)
                                ${row.opened_at
                                    ? `· ouvert ${escapeHtml(formatDateTime(row.opened_at))} (${escapeHtml(String(row.open_count ?? 1))}×)`
                                    : '· non ouvert'}
                            </div>
                            ${row.error_msg
                                ? `<div class="admin-journal-error">${escapeHtml(row.error_msg)}</div>` : ''}
                        </div>
                    `;
                }).join('') : this._message('Aucune livraison journalisée.')}

                <h4 class="admin-section-title">File d’attente</h4>
                ${queued.length ? queued.map((row) => `
                    <div class="admin-journal-row">
                        <div class="admin-journal-head">
                            <span class="admin-journal-type">${escapeHtml(row.event_type || '—')}</span>
                            <span class="admin-badge">
                                ${escapeHtml(OUTBOX_STATUS_LABELS[row.status] || row.status || '—')}
                            </span>
                        </div>
                        <div class="admin-journal-meta">
                            ${escapeHtml(formatDateTime(row.created_at))}
                            · ${escapeHtml(String(row.attempts ?? 0))} tentative(s)
                            ${row.not_before && row.status === 'pending'
                                ? `· prévu ${escapeHtml(formatDateTime(row.not_before))}` : ''}
                        </div>
                        ${row.last_reason
                            ? `<div class="admin-journal-error">${escapeHtml(reasonLabel(row.last_reason))}</div>` : ''}
                    </div>
                `).join('') : this._message('Aucun envoi en file.')}
            `;
        } catch (err) {
            container.innerHTML = this._error(err);
        }
    }

    async _sendTest(userId) {
        const button = this.querySelector('#adminTestBtn');
        const container = this.querySelector('#adminTestResult');
        if (button) button.disabled = true;
        if (container) container.innerHTML = '<span class="admin-placeholder">Envoi en cours…</span>';

        try {
            const result = await api.sendAdminTestNotification(userId);
            const summary = result?.summary || {};
            const sent = Number(summary.success_count || 0);
            const tokens = Number(summary.token_count || 0);

            // Le bilan est celui du prestataire : il dit combien d'appareils ont
            // réellement reçu le push, pas seulement que la demande est acceptée.
            if (!tokens) {
                container.innerHTML = this._message(
                    'Aucun appareil joignable : le test n’a pas pu être délivré.', 'error');
            } else if (sent) {
                container.innerHTML = this._message(
                    `Test délivré à ${sent} appareil(s) sur ${tokens}.`, 'ok');
            } else {
                container.innerHTML = this._message(
                    `Échec de livraison sur ${summary.failure_count || tokens} appareil(s)` +
                    (summary.error ? ` : ${summary.error}` : '.'), 'error');
            }
            await this._loadJournal(userId);
        } catch (err) {
            if (container) container.innerHTML = this._error(err);
        } finally {
            if (button) button.disabled = false;
        }
    }

    // ─── Rendu utilitaire ────────────────────────────────────────────

    _message(text, kind = '') {
        return `<p class="admin-message ${escapeHtml(kind)}">${escapeHtml(text)}</p>`;
    }

    _error(err) {
        return `<p class="admin-message error">${escapeHtml(err?.message || 'Erreur inconnue')}</p>`;
    }

    _toast(message, type = 'success') {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
    }
}

customElements.define('app-admin-page', AdminPage);
