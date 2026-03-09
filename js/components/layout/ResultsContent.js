import { escapeHtml } from '../../utils/escapeHtml.js';

export class ResultsContent extends HTMLElement {
    constructor() {
        super();
        this._lastQuery = '';
        this._lastFilters = {}; // { category, commune, price_type } depuis modale ou recherche
        this._myUserId = null;
        this._loading = false;
        this._pageSize = 10;
        this._currentPage = 1;
        this._hasMore = true;
        this._loadMoreObserver = null;
    }

    connectedCallback() {
        this.innerHTML = `
            <main class="results-content" id="resultsContent">
                <div class="skeletons-wrapper" id="skeletonsWrapper" style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
                    ${this._skeleton()}
                    ${this._skeleton()}
                    ${this._skeleton()}
                </div>

                <!-- CTA Créer une envie -->
                <div class="results-cta" id="resultsCta" style="display: none;">
                    <div class="cta-content">
                        <div class="cta-icon"><i class="material-icons-round">campaign</i></div>
                        <div class="cta-text">
                            <h3>Vous ne trouvez pas votre bonheur ?</h3>
                            <p>Proposez votre propre activité !</p>
                        </div>
                    </div>
                    <button class="create-desire-btn" id="resultsCreateBtn">
                        <i class="material-icons-round">add</i><span>Créer une envie</span>
                    </button>
                </div>

                <div class="cards-wrapper" id="cardsWrapper" style="display: none;">
                    <div id="resultsLoadMoreArea" style="display: none; text-align: center; padding: 8px 0 20px;">
                        <button id="resultsLoadMoreBtn" style="background: var(--bg-card); border: 1px solid var(--border-light); color: var(--text-main); padding: 10px 24px; border-radius: 100px; font-weight: 600; cursor: pointer;">
                            Voir plus
                        </button>
                        <p id="resultsLoadMoreHint" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Défilez pour charger plus</p>
                    </div>
                    <div class="results-footer">
                        <p>Vous avez atteint la fin de la liste.</p>
                        <div class="footer-links">
                            <a href="#">Mentions légales</a><a href="#">Confidentialité</a>
                        </div>
                    </div>
                </div>
            </main>
        `;

        this.setupEventListeners();
        this.setupInfiniteScroll();
    }

    disconnectedCallback() {
        if (this._loadMoreObserver) {
            this._loadMoreObserver.disconnect();
            this._loadMoreObserver = null;
        }
    }

    _skeleton() {
        return `<div style="background: var(--bg-card); border-radius: 20px; padding: 20px; animation: pulse 1.4s ease-in-out infinite;">
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--border-light); flex-shrink: 0;"></div>
                <div style="flex: 1;">
                    <div style="height: 12px; width: 35%; background: var(--border-light); border-radius: 6px; margin-bottom: 8px;"></div>
                    <div style="height: 10px; width: 20%; background: var(--border-light); border-radius: 6px;"></div>
                </div>
            </div>
            <div style="height: 20px; width: 80%; background: var(--border-light); border-radius: 6px; margin-bottom: 12px;"></div>
            <div style="height: 12px; width: 55%; background: var(--border-light); border-radius: 6px;"></div>
        </div>`;
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

    _resetList() {
        const cards = this.querySelector('#cardsWrapper');
        if (!cards) return;
        const footer = cards.querySelector('.results-footer');
        const loadMoreArea = cards.querySelector('#resultsLoadMoreArea');
        Array.from(cards.children).forEach(c => {
            if (c !== footer && c !== loadMoreArea) c.remove();
        });
    }

    _updateLoadMoreUi() {
        const loadMoreArea = this.querySelector('#resultsLoadMoreArea');
        const loadMoreBtn = this.querySelector('#resultsLoadMoreBtn');
        const loadMoreHint = this.querySelector('#resultsLoadMoreHint');
        const footer = this.querySelector('.results-footer');
        if (!loadMoreArea || !loadMoreBtn) return;
        const hasCards = this.querySelectorAll('#cardsWrapper desire-card').length > 0;
        const hasQueryOrFilters = this._lastQuery || this._lastFilters.commune || this._lastFilters.price_type || this._lastFilters.category;
        loadMoreArea.style.display = hasQueryOrFilters && hasCards ? 'block' : 'none';
        loadMoreBtn.disabled = this._loading;
        loadMoreBtn.textContent = this._loading ? 'Chargement...' : 'Voir plus';
        loadMoreBtn.style.display = this._hasMore ? 'inline-flex' : 'none';
        if (loadMoreHint) loadMoreHint.style.display = this._hasMore && !this._loading ? 'block' : 'none';
        if (footer) footer.style.display = hasCards && !this._hasMore ? 'block' : 'none';
    }

    _renderBatch(desires) {
        const cards = this.querySelector('#cardsWrapper');
        if (!cards) return;
        const anchor = cards.querySelector('#resultsLoadMoreArea') || cards.querySelector('.results-footer');

        desires.forEach(d => {
            const themeMap = { sport: 'sport', detente: 'chill', apprentissage: 'learn', rencontres: 'rencontres', decouverte: 'explore' };
            const timeAgo = this._timeAgo(d.created_at);
            const price = d.price_type === 'free' ? 'Gratuit' : d.price_type === 'contribution' ? 'Contribution libre' : `${(d.price_amount || 0).toLocaleString('fr-FR')} FCFA`;
            const card = document.createElement('desire-card');
            card.setAttribute('theme', themeMap[d.category] || 'explore');
            card.setAttribute('title', d.title);
            card.setAttribute('author', d.author_pseudo || 'Anonyme');
            card.setAttribute('time-ago', timeAgo);
            card.setAttribute('avatar', d.author_avatar_url || '/assets/img/avatar.png');
            card.setAttribute('date', new Date(d.event_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
            card.setAttribute('price', price);
            card.setAttribute('commune', d.commune || 'Abidjan');
            card.setAttribute('spots', `${d.spots_taken}/${d.max_spots} places`);
            card.setAttribute('btn-text', 'Rejoindre');
            card.setAttribute('images', d.images && d.images.length > 0 ? d.images.join(',') : '');
            card.setAttribute('description', d.description || '');
            // Mode owner si c'est sa propre envie
            if (this._myUserId && d.author_id && this._myUserId === d.author_id) {
                card.setAttribute('mode', 'owner');
            }
            card.dataset.authorId = d.author_id || ''; // pour desire-view
            card.dataset.desireId = d.id;
            card.setAttribute('desire-id', d.id); // requis par getAttribute('desire-id') dans DesireCard
            card.addEventListener('desire-joined', (e) => {
                e.stopPropagation(); // Empêche le toast intempestif
                document.dispatchEvent(new CustomEvent('view-desire', {
                    detail: { id: d.id, authorId: d.author_id || null, title: d.title, author: d.author_pseudo, timeAgo, commune: d.commune, date: new Date(d.event_date).toLocaleString('fr-FR'), spots: `${d.spots_taken}/${d.max_spots}`, price, avatar: d.author_avatar_url || '/assets/img/avatar.png', images: d.images || [], description: d.description },
                    bubbles: true, composed: true,
                }));
            });
            cards.insertBefore(card, anchor);
        });
    }

    async _loadResults(append = false) {
        if (this._loading) return;
        if (append && !this._hasMore) return;
        const hasQueryOrFilters = this._lastQuery || this._lastFilters.commune || this._lastFilters.price_type || this._lastFilters.category;
        if (!hasQueryOrFilters) return;
        this._loading = true;
        this._updateLoadMoreUi();

        const skeletons = this.querySelector('#skeletonsWrapper');
        const cards = this.querySelector('#cardsWrapper');
        const cta = this.querySelector('#resultsCta');

        if (!append) {
            if (skeletons) { skeletons.style.display = 'flex'; skeletons.style.flexDirection = 'column'; }
            if (cards) cards.style.display = 'none';
            if (cta) cta.style.display = 'none';
        }

        try {
            const { api } = await import('../../api.js');

            // Toujours relire l'ID depuis localStorage (jamais mettre en cache entre sessions)
            if (this._myUserId === null && api.isAuthenticated()) {
                const cached = JSON.parse(localStorage.getItem('distrax-user') || 'null');
                this._myUserId = cached?.id || null;
                if (!this._myUserId) {
                    const me = await api.getMe();
                    this._myUserId = me?.id || null;
                }
            }

            const data = await api.fetchDesires({
                query: this._lastQuery || undefined,
                ...this._lastFilters,
                page: this._currentPage,
                size: this._pageSize
            });
            const { items: desires, hasMore } = this._extractPagedItems(data);
            this._hasMore = hasMore;

            if (!append) this._resetList();

            if (desires.length === 0 && !append) {
                const empty = document.createElement('div');
                empty.style.cssText = 'text-align: center; padding: 60px 20px; color: var(--text-muted);';
                const emptyMsg = this._lastQuery
                    ? `Aucun résultat pour « ${escapeHtml(this._lastQuery)} ».`
                    : 'Aucun résultat pour ces critères.';
                empty.innerHTML = `<i class="material-icons-round" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 12px;">search_off</i><p>${emptyMsg}</p>`;
                const footer = cards.querySelector('.results-footer');
                cards.insertBefore(empty, footer);
            } else {
                this._renderBatch(desires);
                if (desires.length > 0) this._currentPage += 1;
            }

            if (skeletons) skeletons.style.display = 'none';
            if (cards) cards.style.display = 'flex';
            if (cta) cta.style.display = 'block';
            this._updateLoadMoreUi();

        } catch (err) {
            console.warn('Erreur de recherche :', err);
            if (skeletons) skeletons.style.display = 'none';
            if (cards) cards.style.display = 'flex';
        } finally {
            this._loading = false;
            this._updateLoadMoreUi();
        }
    }

    setupInfiniteScroll() {
        const loadMoreArea = this.querySelector('#resultsLoadMoreArea');
        if (!loadMoreArea) return;

        this._loadMoreObserver = new IntersectionObserver(
            (entries) => {
                const isVisible = entries.some((entry) => entry.isIntersecting);
                if (!isVisible) return;
                if (!document.body.classList.contains('state-results')) return;
                if (this._loading || !this._hasMore) return;
                this._loadResults(true);
            },
            { root: null, rootMargin: '220px 0px', threshold: 0.01 }
        );

        this._loadMoreObserver.observe(loadMoreArea);
    }

    /**
     * Vide les résultats affichés et réinitialise l'état interne.
     * Appelée quand l'utilisateur retourne à l'accueil, pour ne jamais
     * afficher d'anciens résultats lors d'une prochaine saisie.
     */
    clearResults() {
        this._lastQuery   = '';
        this._lastFilters = {};
        this._currentPage = 1;
        this._hasMore     = true;
        this._loading     = false;
        this._resetList();

        const skeletons = this.querySelector('#skeletonsWrapper');
        const cards     = this.querySelector('#cardsWrapper');
        const cta       = this.querySelector('#resultsCta');
        if (skeletons) skeletons.style.display = 'none';
        if (cards)     cards.style.display     = 'none';
        if (cta)       cta.style.display       = 'none';
    }

    // Appelée depuis main.ts lors d'une recherche (barre de recherche)
    async setQuery(query) {
        this._lastQuery = typeof query === 'string' ? query : '';
        this._lastFilters = {};
        this._myUserId = null;
        this._currentPage = 1;
        this._hasMore = true;
        this._resetList();
        await this._loadResults(false);
    }

    // Appelée quand l'utilisateur applique les filtres de la modale (avec ou sans mots-clés)
    async setQueryAndFilters(query, filters = {}) {
        this._lastQuery = typeof query === 'string' ? query.trim() : '';
        this._lastFilters = {
            category: filters.category || undefined,
            commune: filters.commune || undefined,
            price_type: filters.price_type || undefined
        };
        this._myUserId = null;
        this._currentPage = 1;
        this._hasMore = true;
        this._resetList();
        await this._loadResults(false);
    }

    _timeAgo(isoDate) {
        const diff = (Date.now() - new Date(isoDate)) / 1000;
        if (diff < 60) return 'À l\'instant';
        if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
        return `Il y a ${Math.floor(diff / 86400)} jour(s)`;
    }

    setupEventListeners() {
        const createBtn = this.querySelector('#resultsCreateBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const event = new CustomEvent('create-desire', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        const loadMoreBtn = this.querySelector('#resultsLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this._loadResults(true));
        }
    }
}

customElements.define('app-results-content', ResultsContent);
