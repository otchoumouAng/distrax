import { TypewriterEffect } from '../animations.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

export class HomeHero extends HTMLElement {
    constructor() {
        super();
        this.isActive = false;
        this._scrollRaf = null;
        this._onScroll = null;
        this._onResize = null;
        this._searchCategoriesLoaded = false;
        this._searchCategoriesLoading = false;
        // The results mode state is handled via global custom events if needed,
        // but HomeHero mainly acts based on its local activation state.
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="home-hero" id="homeHero">
                <div style="position: absolute; top: 20px; right: 20px; z-index: 100;">
                    <app-theme-switch></app-theme-switch>
                </div>
                <div class="search-container" id="searchContainer">
                    <div class="hero-section-wrapper">
                        <div class="hero-section">
                            <div class="logo-box"><i class="material-icons-round">interests</i></div>
                            <p class="hero-text">De quoi avez-vous besoin aujourd'hui ?</p>
                        </div>
                    </div>

                    <div class="search-box" id="searchBox">
                        <form class="search-inner" id="searchForm" action="javascript:void(0);">
                            <button type="button" class="mobile-back-btn" id="mobileBackBtn"
                                aria-label="Fermer la recherche"><i class="material-icons-round">arrow_back</i></button>
                            <i class="material-icons-round search-icon">search</i>
                            <i class="material-icons-round search-icon-active">auto_awesome</i>

                            <input type="text" class="search-input" id="searchInput" autocomplete="off" autocorrect="off"
                                spellcheck="false" role="combobox" aria-expanded="false"
                                aria-controls="suggestionsContainer" aria-label="Que voulez-vous faire ?">

                            <div class="typewriter-cursor" id="cursor"></div>
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

                    <div class="suggestions-container" id="suggestionsContainer">
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
                    </div>
                </div>

                <button class="scroll-down-indicator" id="scrollIndicator" aria-label="Défiler vers les explorations">
                    <span>Explorer les envies</span>
                    <i class="material-icons-round">keyboard_arrow_down</i>
                </button>
            </div>
        `;

        this.cacheElements();
        this.initTypewriter();
        this.initEvents();
        this.initScrollEffect();
    }

    disconnectedCallback() {
        this.destroyScrollEffect();
    }

    cacheElements() {
        this.elements = {
            homeHero: this.querySelector('#homeHero'),
            searchContainer: this.querySelector('#searchContainer'),
            searchBox: this.querySelector('#searchBox'),
            searchForm: this.querySelector('#searchForm'),
            searchInput: this.querySelector('#searchInput'),
            micBtn: this.querySelector('#micBtn'),
            clearBtn: this.querySelector('#clearBtn'),
            submitBtn: this.querySelector('#submitBtn'),
            suggestionsContainer: this.querySelector('#suggestionsContainer'),
            suggestionsGrid: this.querySelector('#suggestionsGrid'),
            scrollIndicator: this.querySelector('#scrollIndicator'),
            mobileBackBtn: this.querySelector('#mobileBackBtn'),
            noResults: this.querySelector('#noResults'),
            suggestionsTitle: this.querySelector('#suggestionsTitle')
        };
    }

    initScrollEffect() {
        const update = () => {
            this._scrollRaf = null;
            const hero = this.elements?.homeHero;
            if (!hero) return;

            // Désactiver l'effet pendant l'état résultats pour rester lisible.
            if (document.body.classList.contains('state-results')) {
                hero.style.setProperty('--hero-scroll-progress', '0');
                return;
            }

            const viewportHeight = window.innerHeight || 1;
            const rawProgress = window.scrollY / (viewportHeight * 0.65);
            const progress = Math.max(0, Math.min(rawProgress, 1));
            hero.style.setProperty('--hero-scroll-progress', progress.toFixed(3));
        };

        this._onScroll = () => {
            if (this._scrollRaf !== null) return;
            this._scrollRaf = window.requestAnimationFrame(update);
        };

        this._onResize = () => {
            if (this._scrollRaf !== null) window.cancelAnimationFrame(this._scrollRaf);
            this._scrollRaf = window.requestAnimationFrame(update);
        };

        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onResize, { passive: true });
        update();
    }

    destroyScrollEffect() {
        if (this._scrollRaf !== null) {
            window.cancelAnimationFrame(this._scrollRaf);
            this._scrollRaf = null;
        }
        if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
    }

    initTypewriter() {
        const phrases = [
            "visiter Grand-Bassam...",
            "une partie de piscine...",
            "boire un bon café...",
            "apprendre de nouvelles choses..."
        ];
        this.typewriter = new TypewriterEffect(this.elements.searchInput, 'je veux', phrases);
        setTimeout(() => this.typewriter.start(), 1000);
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

    async _loadCategoriesForSearchPanel() {
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
    }

    activateSearch() {
        if (!this.isActive) {
            this.isActive = true;
            this.typewriter.stop();

            this.elements.searchContainer.classList.add('active');
            this.elements.searchBox.classList.add('active');
            this.elements.suggestionsContainer.classList.add('active');
            this.elements.searchInput.setAttribute('aria-expanded', 'true');

            this.elements.searchInput.focus();
            if (this.elements.suggestionsTitle) {
                this.elements.suggestionsTitle.textContent = 'Catégories';
                this.elements.suggestionsTitle.style.opacity = '1';
            }
            if (this._searchCategoriesLoaded && this._getSuggestionChips().length > 0) {
                this.filterSuggestions(this.elements.searchInput.value);
            } else {
                this._loadCategoriesForSearchPanel().then(() => {
                    if (this.isActive) this.filterSuggestions(this.elements.searchInput.value);
                });
            }

            this.dispatchEvent(new CustomEvent('search-activated', { bubbles: true, composed: true }));
        }
    }

    deactivateSearch(force = false) {
        if (this.elements.searchInput.value.trim() === '' || force) {
            this.isActive = false;
            this.elements.searchContainer.classList.remove('active');
            this.elements.searchBox.classList.remove('active');
            this.elements.suggestionsContainer.classList.remove('active');
            this.elements.searchInput.setAttribute('aria-expanded', 'false');
            this.elements.searchInput.value = '';
            this.updateActionButtons();

            this.typewriter.start();
            this.elements.searchInput.blur();

            this.dispatchEvent(new CustomEvent('search-deactivated', { bubbles: true, composed: true }));
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
                // Emettre l'événement "recherche-validee" qui sera écouté globalement
                const event = new CustomEvent('recherche-validee', {
                    detail: { query: value, icon: forcedIcon },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);

                setTimeout(() => {
                    this.elements.submitBtn.innerHTML = '<i class="material-icons-round">arrow_forward</i>';
                    this.elements.submitBtn.style.background = '';
                }, 500);
            }, 400);
        }
    }

    initEvents() {
        this.elements.searchBox.addEventListener('click', () => { if (!this.isActive) this.activateSearch(); });
        this.elements.searchInput.addEventListener('focus', () => this.activateSearch());
        this.elements.searchInput.addEventListener('input', () => {
            this.updateActionButtons();
            this.filterSuggestions(this.elements.searchInput.value);
        });

        this.elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.elements.searchInput.value.trim()) this.submitSearch();
        });

        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.deactivateSearch(true);
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
                this.deactivateSearch(true);
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
            this.deactivateSearch(true);
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
                    this.deactivateSearch(true);
                    this.dispatchEvent(new CustomEvent('create-desire', { bubbles: true, composed: true }));
                }, 1000);
            });
        }

        this.elements.scrollIndicator.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('scroll-to-explore', { bubbles: true, composed: true }));
        });

        // Fermer la recherche au clic ailleurs sur la page
        const closeOnOutsideClick = (e) => {
            if (this.isActive && !this.elements.searchContainer.contains(e.target) && !e.target.closest('app-home-hero')) {
                this.deactivateSearch();
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('touchstart', closeOnOutsideClick, { passive: true });

    }
}

customElements.define('app-home-hero', HomeHero);
