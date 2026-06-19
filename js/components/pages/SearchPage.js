import { escapeHtml } from '../../utils/escapeHtml.js';
import { createDesireCard } from '../../utils/desireCards.js';

export class SearchPage extends HTMLElement {
    constructor() {
        super();
        this._searchCategoriesLoaded = false;
        this._searchCategoriesLoading = false;
        this._latestDesiresLoaded = false;
    }

    connectedCallback() {
        this.innerHTML = `
            <main class="search-page-content" id="searchPageMain" style="min-height: 100svh; background: var(--bg-card); position: relative;">
                <!-- On force la classe "active" pour que le design "recherche ouverte" s'applique d'office -->
                <div class="search-container active" id="searchContainer" style="position: relative; transform: none; top: 0; left: 0; width: 100%; max-width: 680px; margin: 0 auto; padding: 20px 16px; background: transparent;">
                    <div class="search-box active" id="searchBox" style="transform: none; top: 0;">
                        <form class="search-inner" id="searchForm" action="javascript:void(0);">
                            <button type="button" class="mobile-back-btn" id="mobileBackBtn" aria-label="Retour" style="display: flex;">
                                <i class="material-icons-round">arrow_back</i>
                            </button>
                            <i class="material-icons-round search-icon" style="display: none;">search</i>

                            <input type="text" class="search-input" id="searchInput" autocomplete="off" autocorrect="off"
                                spellcheck="false" role="combobox" aria-expanded="true"
                                aria-controls="suggestionsContainer" aria-label="Que voulez-vous faire ?" placeholder="Je veux..." style="padding-left: 48px;">

                            <div class="icons-container" id="actionsContainer">
                                <button type="button" class="action-btn mic-btn" id="micBtn"
                                    aria-label="Recherche vocale"><i class="material-icons-round">mic</i></button>
                                <button type="button" class="action-btn" id="clearBtn" style="display: none;"
                                    aria-label="Effacer le texte"><i class="material-icons-round">close</i></button>
                                <button type="submit" class="action-btn submit-btn" id="submitBtn"
                                    aria-label="Lancer la recherche"><i
                                        class="material-icons-round">arrow_forward</i></button>
                            </div>
                        </form>
                    </div>

                    <div class="suggestions-container active" id="suggestionsContainer" style="position: relative; opacity: 1; pointer-events: auto; transform: none; margin-top: 24px; max-height: none; box-shadow: none; border: none; background: transparent;">
                        <div class="suggestions-header"><span class="suggestions-title"
                                id="suggestionsTitle">Catégories</span></div>
                        <div class="suggestions-grid" id="suggestionsGrid" aria-live="polite">
                        </div>

                        <div class="no-results" id="noResults" style="display: none;">
                            <div class="no-results-icon"><i class="material-icons-round">manage_search</i></div>
                            <h3 id="noResultsTitle">Votre recherche</h3>
                            <p id="noResultsHint">Appuyez sur ↵ pour lancer la recherche</p>
                            <button type="button" class="create-desire-btn" id="createDesireBtn">
                                <i class="material-icons-round">add</i><span>Créer cette envie</span>
                            </button>
                        </div>
                        
                        <div id="latestDesiresSection" class="latest-desires-section" style="display: block; margin-top: 32px;">
                            <div class="suggestions-header latest-desires-header">
                                <span class="suggestions-title latest-desires-title">Dernières annonces</span>
                            </div>
                            <div class="latest-desires-grid" id="latestDesiresGrid">
                                <div class="desire-card" style="background: var(--bg-card); border-radius: 20px; padding: 16px; animation: pulse 1.4s ease-in-out infinite;">
                                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--border-light);"></div>
                                        <div style="height: 16px; width: 120px; background: var(--border-light); border-radius: 4px;"></div>
                                    </div>
                                    <div style="height: 20px; width: 80%; background: var(--border-light); border-radius: 4px; margin-bottom: 8px;"></div>
                                    <div style="height: 20px; width: 60%; background: var(--border-light); border-radius: 4px;"></div>
                                </div>
                                <div class="desire-card" style="background: var(--bg-card); border-radius: 20px; padding: 16px; animation: pulse 1.4s ease-in-out infinite;">
                                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--border-light);"></div>
                                        <div style="height: 16px; width: 120px; background: var(--border-light); border-radius: 4px;"></div>
                                    </div>
                                    <div style="height: 20px; width: 80%; background: var(--border-light); border-radius: 4px; margin-bottom: 8px;"></div>
                                    <div style="height: 20px; width: 60%; background: var(--border-light); border-radius: 4px;"></div>
                                </div>
                            </div>
                            <div class="latest-desires-actions" style="margin-top: 16px;">
                                <button type="button" id="exploreAllBtn" class="latest-desires-btn">
                                    <span>Voir toutes les envies</span>
                                    <i class="material-icons-round" style="font-size: 20px;">arrow_forward</i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `;

        this.cacheElements();
        this.initEvents();
    }

    cacheElements() {
        this.elements = {
            searchForm: this.querySelector('#searchForm'),
            searchInput: this.querySelector('#searchInput'),
            micBtn: this.querySelector('#micBtn'),
            clearBtn: this.querySelector('#clearBtn'),
            submitBtn: this.querySelector('#submitBtn'),
            suggestionsContainer: this.querySelector('#suggestionsContainer'),
            suggestionsGrid: this.querySelector('#suggestionsGrid'),
            mobileBackBtn: this.querySelector('#mobileBackBtn'),
            noResults: this.querySelector('#noResults'),
            suggestionsTitle: this.querySelector('#suggestionsTitle')
        };
    }

    _getSuggestionChips() {
        return this.querySelectorAll('#suggestionsGrid .suggestion-chip');
    }

    _renderCategoryChips(categories) {
        const grid = this.elements.suggestionsGrid;
        if (!grid || !Array.isArray(categories) || categories.length === 0) return;
        const html = categories.map((cat) => {
            const slug = (typeof cat === 'object' ? cat.slug : cat) || '';
            const label = (typeof cat === 'object' ? cat.label : null) || slug;
            const icon = (typeof cat === 'object' ? cat.icon : null) || 'label';
            const kw = `${slug} ${label}`.toLowerCase().replace(/"/g, '');
            return `<div class="suggestion-chip category-suggestion-chip" role="button" tabindex="0" data-category="${escapeHtml(String(slug))}" data-keywords="${escapeHtml(kw)}">
                <div class="chip-icon"><i class="material-icons-round">${escapeHtml(String(icon))}</i></div>
                <span>${escapeHtml(String(label))}</span>
            </div>`;
        }).join('');
        grid.innerHTML = html;
    }

    async _loadCategories() {
        const grid = this.elements.suggestionsGrid;
        if (!grid) return;
        if (this._searchCategoriesLoading) return;
        this._searchCategoriesLoading = true;
        grid.innerHTML = '<span class="categories-loading" style="display:flex;align-items:center;justify-content:center;padding:20px;color:var(--text-muted);font-size:14px;">Chargement des catégories…</span>';
        try {
            const { api } = await import('../../api.js');
            const raw = await api.getCategoriesFull();
            const items = Array.isArray(raw) ? raw.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)) : [];
            this._renderCategoryChips(items);
            this._searchCategoriesLoaded = true;
        } catch (_) {
            this._renderCategoryChips([]);
            this._searchCategoriesLoaded = true;
        } finally {
            this._searchCategoriesLoading = false;
        }
    }

    filterSuggestions(query) {
        const PREFIX = 'je veux';
        let term = query.toLowerCase().trim();
        if (term.startsWith(PREFIX)) term = term.substring(PREFIX.length).trim();

        const chips = this._getSuggestionChips();
        const loading = this.elements.suggestionsGrid?.querySelector('.categories-loading');
        if (loading || chips.length === 0) {
            if (this.elements.suggestionsTitle && !loading) {
                this.elements.suggestionsTitle.textContent = term === '' ? 'Catégories' : `Filtrer : « ${query.replace(/^Je veux\s*/i, '').trim()} »`;
            }
            return;
        }

        let visibleCount = 0;
        chips.forEach((chip) => {
            const slug = (chip.getAttribute('data-category') || '').toLowerCase();
            const keywords = (chip.getAttribute('data-keywords') || '').toLowerCase();
            const labelText = (chip.textContent || '').toLowerCase();
            const matches = term === '' || slug.includes(term) || keywords.includes(term) || labelText.includes(term);
            if (matches) {
                chip.classList.remove('filtered-out');
                visibleCount++;
            } else {
                chip.classList.add('filtered-out');
            }
        });

        if (visibleCount === 0 && term !== '') {
            if (this.elements.noResults) {
                this.elements.noResults.style.display = 'flex';
                const titleEl = this.elements.noResults.querySelector('#noResultsTitle');
                const hintEl = this.elements.noResults.querySelector('#noResultsHint');
                if (titleEl) titleEl.textContent = `"${query.replace(/^Je veux\s*/i, '').trim()}"`;
                if (hintEl) hintEl.textContent = 'Appuyez sur ↵ pour lancer la recherche';
            }
            if (this.elements.suggestionsTitle) this.elements.suggestionsTitle.style.opacity = '0';
        } else {
            if (this.elements.noResults) this.elements.noResults.style.display = 'none';
            if (this.elements.suggestionsTitle) {
                this.elements.suggestionsTitle.style.opacity = '1';
                this.elements.suggestionsTitle.textContent =
                    term === '' ? 'Catégories' : `Catégories · « ${query.replace(/^Je veux\s*/i, '').trim()} »`;
            }
        }
        
        const latestSection = this.querySelector('#latestDesiresSection');
        if (latestSection) {
            latestSection.style.display = (term === '') ? 'block' : 'none';
        }
    }

    async _loadLatestDesires() {
        const section = this.querySelector('#latestDesiresSection');
        const grid = this.querySelector('#latestDesiresGrid');
        if (!grid || this._latestDesiresLoaded) return;
        
        try {
            const { api } = await import('../../api.js');
            const desiresPromise = api.fetchDesires({ size: 5 });
            let currentUserPromise = Promise.resolve(null);
            let joinedDesiresPromise = Promise.resolve([]);

            if (api.isAuthenticated()) {
                const cachedUser = JSON.parse(localStorage.getItem('dystrax-user') || 'null');
                currentUserPromise = cachedUser?.id ? Promise.resolve(cachedUser) : api.getMe().catch(() => null);
                joinedDesiresPromise = api.getJoinedDesires().catch(() => []);
            }

            const [data, currentUser, joinedDesires] = await Promise.all([
                desiresPromise,
                currentUserPromise,
                joinedDesiresPromise,
            ]);
            const desires = data?.items || data || [];
            
            if (desires.length > 0) {
                const joinedDesireIds = new Map(
                    Array.isArray(joinedDesires) ? joinedDesires.map((desire) => [String(desire.id), desire.status || 'pending']) : []
                );

                grid.replaceChildren(
                    ...desires.slice(0, 5).map((desire) =>
                        createDesireCard(desire, {
                            myUserId: currentUser?.id || null,
                            joinedDesireIds,
                            openDetailsOnJoin: true,
                        })
                    )
                );
                section.style.display = this.elements.searchInput.value.trim() === '' ? 'block' : 'none';
                this._latestDesiresLoaded = true;

                const exploreBtn = this.querySelector('#exploreAllBtn');
                if (exploreBtn) {
                    exploreBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('navigate-home'));
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('scroll-to-explore'));
                        }, 700);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load latest desires', e);
        }
    }

    updateActionButtons() {
        if (this.elements.searchInput.value.length > 0) {
            this.elements.micBtn.style.display = 'none';
            this.elements.clearBtn.style.display = 'flex';
            this.elements.submitBtn.classList.add('visible');
        } else {
            this.elements.micBtn.style.display = 'flex';
            this.elements.clearBtn.style.display = 'none';
            this.elements.submitBtn.classList.remove('visible');
        }
    }

    submitSearch(forcedIcon = 'search') {
        const value = this.elements.searchInput.value.trim();
        if (value) {
            this.elements.submitBtn.style.background = '#10b981';
            this.elements.submitBtn.innerHTML = '<i class="material-icons-round">check</i>';
            setTimeout(() => {
                const event = new CustomEvent('recherche-validee', {
                    detail: { query: value, icon: forcedIcon },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);

                setTimeout(() => {
                    this.elements.submitBtn.innerHTML = '<i class="material-icons-round">arrow_forward</i>';
                    this.elements.submitBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                }, 500);
            }, 400);
        }
    }

    initEvents() {
        this.elements.searchInput.addEventListener('input', () => {
            this.updateActionButtons();
            this.filterSuggestions(this.elements.searchInput.value);
        });

        this.elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.elements.searchInput.value.trim()) this.submitSearch();
        });

        this.elements.suggestionsGrid.addEventListener('click', (e) => {
            const chip = e.target.closest('.suggestion-chip');
            if (!chip || chip.classList.contains('filtered-out')) return;
            const category = chip.getAttribute('data-category');
            if (category) {
                const categoryLabel = (chip.querySelector('span')?.textContent || category).trim();
                document.dispatchEvent(new CustomEvent('apply-filters', {
                    detail: {
                        query: '',
                        category,
                        categoryLabel,
                        commune: undefined,
                        price_type: undefined,
                    },
                    bubbles: true,
                    composed: true,
                }));
                return;
            }
            const val = chip.getAttribute('data-value');
            if (val) {
                this.elements.searchInput.value = 'Je veux ' + val.charAt(0).toLowerCase() + val.slice(1);
                this.updateActionButtons();
                setTimeout(() => this.submitSearch('search'), 100);
            }
        });

        this.elements.clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.elements.searchInput.value = '';
            this.updateActionButtons();
            this.filterSuggestions('');
            this.elements.searchInput.focus();
        });

        this.elements.mobileBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }));
        });

        const createDesireBtn = this.querySelector('#createDesireBtn');
        if (createDesireBtn) {
            createDesireBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;

                btn.classList.add('success');
                btn.innerHTML = '<i class="material-icons-round">check</i><span>Ouverture...</span>';

                setTimeout(() => {
                    btn.classList.remove('success');
                    btn.innerHTML = originalHtml;
                    this.dispatchEvent(new CustomEvent('create-desire', { bubbles: true, composed: true }));
                }, 1000);
            });
        }
    }

    show() {
        this.style.display = 'block';
        if (!this._searchCategoriesLoaded) {
            this._loadCategories().then(() => {
                this.filterSuggestions(this.elements.searchInput.value);
            });
        }
        if (!this._latestDesiresLoaded) {
            this._loadLatestDesires();
        }
        // Small delay to allow the element to be displayed before focusing
        setTimeout(() => {
            this.elements.searchInput.focus();
        }, 100);
    }

    hide() {
        this.style.display = 'none';
        this.elements.searchInput.blur();
    }
}

customElements.define('app-search-page', SearchPage);
