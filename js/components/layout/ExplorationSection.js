import { DEFAULT_AVATAR_PATH } from '../../utils/escapeHtml.js';
import { formatSpotsLabel } from '../../utils/formatSpots.js';
import { createDesireCard } from '../../utils/desireCards.js';

/**
 * ExplorationSection — Affiche les dernières envies depuis l'API.
 * Gère le filtrage par catégorie (filter-pills) et la pagination infinie.
 */
export class ExplorationSection extends HTMLElement {
    constructor() {
        super();
        this._activeCategory = null;
        this._activeFilters = {}; // { query, commune, price_type } depuis la modale Filtres
        this._desires = [];
        this._loading = false;
        this._pageSize = 10;
        this._currentPage = 1;
        this._hasMore = true;
        this._loadMoreObserver = null;
        // Note: _myUserId n'est pas caché ici, il est lu depuis le localStorage à chaque loadDesires
    }

    connectedCallback() {
        this.innerHTML = `
            <section class="exploration-section" id="explorationSection">
                <div class="exploration-header">
                    <h2 class="exploration-title" id="explorationTitle">Dernières envies autour de vous</h2>
                </div>

                <!-- Sentinelle pour sticky -->
                <div class="filters-sentinel" style="height: 1px; width: 100%;"></div>

                <div class="filters-container" id="explorationFilters">
                    <filter-pill icon="tune" id="filterOpenBtn">Filtres</filter-pill>
                    <span id="categoryPillsLoading" style="display:inline-block; color: var(--text-light); font-size: 13px; padding: 6px 8px;">Chargement...</span>
                    
                    <div style="width: 1px; height: 24px; background: var(--border-light); align-self: center; margin: 0 4px;"></div>
                    <button class="create-quick-btn" title="Créer une envie" id="quickCreateBtn">
                        <i class="material-icons-round">add</i> Créer
                    </button>
                </div>

                <div class="exploration-grid" id="explorationGrid">
                    <!-- Skeletons de chargement -->
                    ${this._skeletons(3)}
                </div>

                <div id="loadMoreArea" style="text-align: center; padding: 10px 0; display: none;">
                    <button id="loadMoreBtn" style="background: var(--bg-card); border: 1px solid var(--border-light); color: var(--text-main); padding: 12px 28px; border-radius: 100px; font-weight: 600; cursor: pointer;">
                        Voir plus
                    </button>
                    <p id="loadMoreHint" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Défilez pour charger plus</p>
                    <p id="exploreEndHint" style="display: none; margin-top: 8px; font-size: 12px; color: var(--text-muted);">Vous avez atteint la fin de la liste.</p>
                </div>

                <footer class="page-footer">
                    <span>© 2026 Dystrax</span><span class="dot">•</span>
                    <span>Fait avec <i class="material-icons-round heart">favorite</i></span><span class="dot">•</span>
                    <a href="#">Confidentialité</a>
                </footer>
            </section>
        `;

        this.setupStickyObserver();
        this.setupListeners();
        this._loadCategoryPills();
        this.loadDesires();
        this.setupInfiniteScroll();
    }

    disconnectedCallback() {
        if (this._loadMoreObserver) {
            this._loadMoreObserver.disconnect();
            this._loadMoreObserver = null;
        }
    }

    _skeletons(n) {
        return Array.from({ length: n }, () => `
            <div class="desire-card" style="background: var(--bg-card); border-radius: 20px; padding: 16px; animation: pulse 1.4s ease-in-out infinite;">
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--border-light);"></div>
                    <div style="flex: 1;">
                        <div style="height: 12px; width: 40%; background: var(--border-light); border-radius: 6px; margin-bottom: 6px;"></div>
                        <div style="height: 10px; width: 25%; background: var(--border-light); border-radius: 6px;"></div>
                    </div>
                </div>
                <div style="height: 18px; width: 85%; background: var(--border-light); border-radius: 6px; margin-bottom: 10px;"></div>
                <div style="height: 12px; width: 60%; background: var(--border-light); border-radius: 6px;"></div>
            </div>
        `).join('');
    }

    _themeFromCategory(cat) {
        const map = { sport: 'sport', detente: 'chill', apprentissage: 'learn', rencontres: 'rencontres', sorties: 'explore', decouverte: 'explore' };
        return map[cat] || 'explore';
    }

    /** Aligne les pills « Tous / catégories » avec _activeCategory (ex. après clic depuis la recherche). */
    _syncCategoryPillsUi() {
        const filtersContainer = this.querySelector('#explorationFilters');
        if (!filtersContainer) return;
        filtersContainer.querySelectorAll('.category-pill').forEach((p) => {
            const cat = p.dataset.category ?? '';
            const isTous = cat === '';
            const match = (isTous && !this._activeCategory) || (cat === this._activeCategory);
            if (match) p.setAttribute('active', '');
            else p.removeAttribute('active');
        });
    }

    _formatDate(iso) {
        if (!iso) return 'Date à confirmer';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    _formatPrice(desire) {
        if (desire.price_type === 'free') return 'Gratuit';
        if (desire.price_type === 'contribution') return 'Contribution libre';
        const amount = desire.price_amount;
        return amount ? `${amount.toLocaleString('fr-FR')} FCFA` : 'Payant';
    }

    _timeAgo(isoDate) {
        const diff = (Date.now() - new Date(isoDate)) / 1000;
        if (diff < 60) return 'À l\'instant';
        if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
        return `Il y a ${Math.floor(diff / 86400)} jour(s)`;
    }

    renderDesires(desires, append = false, myUserId = null) {
        const grid = this.querySelector('#explorationGrid');
        if (!append) grid.innerHTML = '';

        if (desires.length === 0 && !append) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); grid-column: 1 / -1;">
                    <i class="material-icons-round" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 12px;">search_off</i>
                    <p>Aucune envie dans cette catégorie pour le moment.</p>
                    <p style="font-size: 13px; margin-top: 4px;">Soyez le premier à en créer une !</p>
                </div>`;
            return;
        }

        desires.forEach(d => {
            const card = createDesireCard(d, { myUserId, openDetailsOnJoin: true });
            grid.appendChild(card);
        });
    }

    _extractPagedItems(data) {
        if (Array.isArray(data)) {
            return { items: data, hasMore: data.length >= this._pageSize };
        }

        const items = Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.data)
                    ? data.data
                    : [];

        let hasMore = items.length >= this._pageSize;
        if (typeof data?.has_next === 'boolean') hasMore = data.has_next;
        if (typeof data?.hasMore === 'boolean') hasMore = data.hasMore;
        if (data?.next_page !== undefined && data?.next_page !== null) hasMore = true;

        return { items, hasMore };
    }

    _updateLoadMoreUi() {
        const loadMoreArea = this.querySelector('#loadMoreArea');
        const loadMoreBtn = this.querySelector('#loadMoreBtn');
        const loadMoreHint = this.querySelector('#loadMoreHint');
        const endHint = this.querySelector('#exploreEndHint');
        if (!loadMoreArea || !loadMoreBtn) return;

        const hasCards = this._desires.length > 0;
        loadMoreArea.style.display = hasCards ? 'block' : 'none';
        loadMoreBtn.disabled = this._loading;
        loadMoreBtn.textContent = this._loading ? 'Chargement...' : 'Voir plus';
        if (loadMoreHint) loadMoreHint.style.display = this._hasMore && !this._loading ? 'block' : 'none';
        loadMoreBtn.style.display = this._hasMore ? 'inline-flex' : 'none';
        if (endHint) endHint.style.display = hasCards && !this._hasMore ? 'block' : 'none';
    }

    setupInfiniteScroll() {
        const loadMoreArea = this.querySelector('#loadMoreArea');
        if (!loadMoreArea) return;

        this._loadMoreObserver = new IntersectionObserver(
            (entries) => {
                const isVisible = entries.some((entry) => entry.isIntersecting);
                if (!isVisible) return;
                if (this._loading || !this._hasMore) return;
                if (document.body.classList.contains('state-results')) return;
                if (this.offsetParent === null) return;
                this.loadDesires(true);
            },
            { root: null, rootMargin: '220px 0px', threshold: 0.01 }
        );

        this._loadMoreObserver.observe(loadMoreArea);
    }

    async loadDesires(append = false) {
        if (this._loading) return;
        if (append && !this._hasMore) return;
        this._loading = true;
        if (!append) {
            this._currentPage = 1;
            this._hasMore = true;
            const hasFilters = this._activeFilters.query || this._activeFilters.commune || this._activeFilters.price_type || this._activeCategory;
            const titleEl = this.querySelector('#explorationTitle');
            if (titleEl) titleEl.textContent = hasFilters ? 'Résultats' : 'Dernières envies autour de vous';
        }
        this._updateLoadMoreUi();

        // Toujours relire l'ID utilisateur depuis localStorage (à jour après login/logout)
        let myUserId = null;
        try {
            const { api } = await import('../../api.js');
            if (api.isAuthenticated()) {
                const cached = JSON.parse(localStorage.getItem('dystrax-user') || 'null');
                myUserId = cached?.id || null;
                if (!myUserId) {
                    const me = await api.getMe();
                    myUserId = me?.id || null;
                }
            }

            // Charger les envies (catégorie + filtres modale)
            const filters = { ...this._activeFilters };
            if (this._activeCategory) filters.category = this._activeCategory;

            if (filters.category !== 'rencontres') {
                filters.exclude_category = 'rencontres';
            }

            filters.page = this._currentPage;
            filters.size = this._pageSize;

            const data = await api.fetchDesires(filters);
            let { items: desires, hasMore } = this._extractPagedItems(data);

            // Filtre de sécurité Front-End (au cas où le backend ne gère pas encore exclude_category)
            if (filters.category !== 'rencontres') {
                desires = desires.filter(d => d.category !== 'rencontres');
            }
            this._hasMore = hasMore;

            if (append) {
                this._desires = [...this._desires, ...desires];
            } else {
                this._desires = desires;
            }

            this.renderDesires(desires, append, myUserId);
            if (desires.length > 0) {
                this._currentPage += 1;
            }

            this._updateLoadMoreUi();

            // Marquer les envies déjà rejointes APRÈS le render (asynchrone pour ne pas bloquer)
            if (api.isAuthenticated() && !append) {
                this._markJoinedDesires(api, myUserId).catch(() => { });
            }

        } catch (err) {
            console.warn('Chargement des envies échoué:', err.message);
            if (!append) {
                this.querySelector('#explorationGrid').innerHTML = `
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); grid-column: 1 / -1;">
                        <i class="material-icons-round" style="font-size: 48px; opacity: 0.5; margin-bottom: 12px;">error_outline</i>
                        <p>Impossible de charger les envies réelles pour le moment.</p>
                    </div>
                `;
            }
        } finally {
            this._loading = false;
            this._updateLoadMoreUi();
        }
    }

    /**
     * Charge les envies rejointes et met les cartes correspondantes en mode='pending'.
     * Appelé de manière asynchrone après renderDesires() pour ne pas bloquer l'affichage.
     */
    async _markJoinedDesires(api, myUserId) {
        try {
            const joined = await api.getJoinedDesires();
            if (!Array.isArray(joined) || joined.length === 0) return;

            const joinedMap = new Map(joined.map(d => [String(d.id), d.status || 'pending']));

            const grid = this.querySelector('#explorationGrid');
            if (!grid) return;

            grid.querySelectorAll('desire-card').forEach(card => {
                const cardId = String(card.dataset?.desireId || card.getAttribute('desire-id') || '');
                if (!cardId) return;
                // Ne pas écraser le mode 'owner'
                if (card.getAttribute('mode') === 'owner') return;
                if (joinedMap.has(cardId)) {
                    const status = joinedMap.get(cardId);
                    card.setAttribute('mode', status === 'accepted' ? 'joined' : 'pending');
                }
            });
        } catch (_) { /* silencieux, pas critique */ }
    }

    setupStickyObserver() {
        const sentinel = this.querySelector('.filters-sentinel');
        const container = this.querySelector('.filters-container');
        if (!sentinel || !container) return;

        new IntersectionObserver(
            ([e]) => container.classList.toggle('is-stuck', e.intersectionRatio < 1),
            { threshold: [1] }
        ).observe(sentinel);
    }

    setupListeners() {
        // Bouton filtres
        this.querySelector('#filterOpenBtn')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('open-filters', { bubbles: true, composed: true }));
        });

        // Créer rapide
        this.querySelector('#quickCreateBtn')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('navigate-creation', { bubbles: true, composed: true }));
        });

        // Filtres catégories — délégation sur le conteneur (pills chargées dynamiquement)
        const filtersContainer = this.querySelector('#explorationFilters');
        if (filtersContainer) {
            filtersContainer.addEventListener('filter-toggled', (e) => {
                const pill = e.target;
                if (!pill.classList.contains('category-pill')) return;
                const isNowActive = e.detail.active;
                const category = pill.dataset.category;

                // Exclusivité
                if (isNowActive) {
                    filtersContainer.querySelectorAll('.category-pill').forEach(p => {
                        if (p !== pill) p.removeAttribute('active');
                    });
                    this._activeCategory = (category && category !== '') ? category : null;
                } else {
                    this._activeCategory = null;
                }

                if (!this._activeCategory) {
                    this._activeFilters = {};
                    document.dispatchEvent(new CustomEvent('filters-cleared', { bubbles: true, composed: true }));
                }

                if (document.body.classList.contains('state-results')) {
                    let headerTitle = 'Tous';
                    if (this._activeCategory) {
                        const activePill = filtersContainer.querySelector('.category-pill[active]');
                        headerTitle = activePill?.dataset?.label || this._activeCategory;
                    }
                    window.dispatchEvent(new CustomEvent('results-header-title', {
                        detail: { title: headerTitle },
                        bubbles: true,
                    }));
                }

                this.loadDesires();
            });
        }

        // Charger plus
        this.querySelector('#loadMoreBtn')?.addEventListener('click', () => this.loadDesires(true));

        // Filtres (modale, clic catégorie depuis la recherche, etc.)
        document.addEventListener('apply-filters', (e) => {
            const d = e.detail || {};
            this._activeFilters = {
                query: d.query || undefined,
                commune: d.commune || undefined,
                price_type: d.price_type || undefined
            };
            if (d.category !== undefined && d.category !== null && String(d.category).trim() !== '') {
                this._activeCategory = String(d.category).trim();
            } else if (d.category === null || d.category === '') {
                this._activeCategory = null;
            }
            this._syncCategoryPillsUi();
            this._loading = false;
            if (d.category !== undefined && String(d.category || '').trim() !== '') {
                const activePill = this.querySelector('#explorationFilters .category-pill[active]');
                const headerLabel = activePill?.dataset?.label || d.categoryLabel || d.category;
                window.dispatchEvent(new CustomEvent('results-header-title', {
                    detail: { title: headerLabel },
                    bubbles: true,
                }));
            }
            this.loadDesires();
        });
    }

    async _loadCategoryPills() {
        const container = this.querySelector('#explorationFilters');
        if (!container) return;
        const loading = container.querySelector('#categoryPillsLoading');
        const divider = container.querySelector('div[style*="1px"]');

        try {
            const { api } = await import('../../api.js');
            const raw = await api.getCategoriesFull();
            if (loading) loading.remove();
            const list = Array.isArray(raw) ? raw.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)) : [];
            const tousPill = document.createElement('filter-pill');
            tousPill.setAttribute('icon', 'apps');
            tousPill.setAttribute('interactive', '');
            tousPill.classList.add('category-pill', 'pill-tous');
            tousPill.dataset.category = '';
            tousPill.textContent = 'Tous';
            if (!this._activeCategory) tousPill.setAttribute('active', '');
            container.insertBefore(tousPill, divider);

            list.forEach((cat) => {
                const slug = (typeof cat === 'object' ? cat.slug : cat) || '';
                const icon = (typeof cat === 'object' ? cat.icon : null) || 'label';
                const label = (typeof cat === 'object' ? cat.label : null) || slug;
                const pill = document.createElement('filter-pill');
                pill.setAttribute('icon', icon || 'label');
                pill.setAttribute('interactive', '');
                pill.classList.add('category-pill');
                pill.dataset.category = slug;
                pill.dataset.label = label;
                pill.textContent = label;
                if (this._activeCategory === slug) pill.setAttribute('active', '');
                container.insertBefore(pill, divider);
            });
        } catch (e) {
            console.warn('[ExplorationSection] Catégories non chargées:', e.message);
            if (loading) loading.remove();
            const list = [];
            const tousPill = document.createElement('filter-pill');
            tousPill.setAttribute('icon', 'apps');
            tousPill.setAttribute('interactive', '');
            tousPill.classList.add('category-pill', 'pill-tous');
            tousPill.dataset.category = '';
            tousPill.textContent = 'Tous';
            if (!this._activeCategory) tousPill.setAttribute('active', '');
            container.insertBefore(tousPill, divider);
            list.forEach((cat) => {
                const pill = document.createElement('filter-pill');
                pill.setAttribute('icon', cat.icon);
                pill.setAttribute('interactive', '');
                pill.classList.add('category-pill');
                pill.dataset.category = cat.slug;
                pill.dataset.label = cat.label;
                pill.textContent = cat.label;
                if (this._activeCategory === cat.slug) pill.setAttribute('active', '');
                container.insertBefore(pill, divider);
            });
        }
    }
}

customElements.define('app-exploration-section', ExplorationSection);
