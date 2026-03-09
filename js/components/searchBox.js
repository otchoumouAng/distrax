export class SearchBox {
    constructor(elements, uiState, typewriter) {
        this.elements = elements;
        this.uiState = uiState;
        this.typewriter = typewriter;
        this.isActive = false;

        this.initEvents();
    }

    filterSuggestions(query) {
        const PREFIX = 'je veux';
        let term = query.toLowerCase().trim();
        if (term.startsWith(PREFIX)) term = term.substring(PREFIX.length).trim();

        let visibleCount = 0;

        this.elements.suggestionChips.forEach(chip => {
            const value = chip.getAttribute('data-value').toLowerCase();
            const keywords = chip.getAttribute('data-keywords').toLowerCase();
            const matches = term === '' || value.includes(term) || keywords.includes(term);

            if (matches) {
                chip.classList.remove('filtered-out');
                visibleCount++;
            } else {
                chip.classList.add('filtered-out');
            }
        });

        if (visibleCount === 0 && term !== '') {
            if (this.elements.noResults) this.elements.noResults.style.display = 'flex';
            if (this.elements.suggestionsTitle) this.elements.suggestionsTitle.style.opacity = '0';
        } else {
            if (this.elements.noResults) this.elements.noResults.style.display = 'none';
            if (this.elements.suggestionsTitle) {
                this.elements.suggestionsTitle.style.opacity = '1';
                this.elements.suggestionsTitle.textContent = term === '' ? 'Tendances' : `Résultats pour "${query.replace(/^Je veux\s*/i, '').trim()}"`;
            }
        }
    }

    activateSearch() {
        if (!this.isActive && !this.uiState.isResultsMode) {
            this.isActive = true;
            this.typewriter.stop();

            this.elements.searchContainer.classList.add('active');
            this.elements.searchBox.classList.add('active');
            this.elements.suggestionsContainer.classList.add('active');
            this.elements.searchInput.setAttribute('aria-expanded', 'true');

            this.elements.searchInput.focus();
            this.filterSuggestions(this.elements.searchInput.value);
        }
    }

    deactivateSearch(force = false) {
        if ((this.elements.searchInput.value.trim() === '' || force) && !this.uiState.isResultsMode) {
            this.isActive = false;
            this.elements.searchContainer.classList.remove('active');
            this.elements.searchBox.classList.remove('active');
            this.elements.suggestionsContainer.classList.remove('active');
            this.elements.searchInput.setAttribute('aria-expanded', 'false');
            this.elements.searchInput.value = '';
            this.updateActionButtons();

            this.typewriter.start();
            this.elements.searchInput.blur();
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
                this.uiState.triggerResultsTransition(value, forcedIcon);
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

        this.elements.suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.getAttribute('data-value');
                this.elements.searchInput.value = 'Je veux ' + val.charAt(0).toLowerCase() + val.slice(1);
                this.updateActionButtons();
                const icon = chip.querySelector('i').textContent;
                setTimeout(() => this.submitSearch(icon), 100);
            });
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

        const createDesireBtn = document.getElementById('createDesireBtn');
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
                }, 1000);
            });
        }
    }
}
