const PRICE_LABELS = { free: 'Gratuit', paid: 'Payant', contribution: 'Contribution libre' };
const DATE_LABELS = { today: "Aujourd'hui", tomorrow: 'Demain', weekend: 'Ce week-end' };

export class ResultsHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <header class="results-header" id="resultsHeader">
                <div class="header-content">
                    <div class="header-title-group">
                        <button id="resultsBackBtn" class="results-back-btn" title="Retour à l'accueil"
                            aria-label="Retour à la page d'accueil">
                            <i class="material-icons-round">arrow_back</i>
                        </button>
                        <h1 class="header-title" id="headerTitle">Résultats</h1>
                    </div>
                </div>
                <div class="results-filter-strip">
                    <button type="button" class="results-filter-btn" id="resultsFilterBtn"
                        title="Lieu, prix, date, mots-clés">
                        <i class="material-icons-round" aria-hidden="true">tune</i>
                        <span>Filtres</span>
                    </button>
                    <p class="results-filter-summary" id="resultsFilterSummary">Lieu, prix, date…</p>
                </div>
            </header>
        `;

        this.setupEventListeners();
    }

    _updateFilterSummary(detail) {
        const el = this.querySelector('#resultsFilterSummary');
        if (!el) return;
        const d = detail || {};
        const parts = [];
        if (d.commune && String(d.commune).trim()) parts.push(String(d.commune).trim());
        if (d.price_type && PRICE_LABELS[d.price_type]) parts.push(PRICE_LABELS[d.price_type]);
        if (d.date && DATE_LABELS[d.date]) parts.push(DATE_LABELS[d.date]);
        if (d.query && String(d.query).trim()) parts.push(`« ${String(d.query).trim().slice(0, 28)}${String(d.query).length > 28 ? '…' : ''} »`);
        el.textContent = parts.length > 0 ? parts.join(' · ') : 'Lieu, prix, date…';
        el.classList.toggle('has-active', parts.length > 0);
    }

    _setTitle(text) {
        const titleElement = this.querySelector('#headerTitle');
        if (titleElement && text != null && String(text).trim() !== '') {
            titleElement.textContent = String(text).trim();
        }
    }

    setupEventListeners() {
        const backBtn = this.querySelector('#resultsBackBtn');

        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('navigate-back', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        const filterBtn = this.querySelector('#resultsFilterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('open-filters', { bubbles: true, composed: true }));
            });
        }
        window.addEventListener('recherche-validee', (e) => {
            if (e.detail && e.detail.query) {
                this._setTitle(e.detail.query);
                this._updateFilterSummary({ query: e.detail.query });
            }
        });

        document.addEventListener('apply-filters', (e) => {
            const d = e.detail || {};
            this._updateFilterSummary(d);
            if (d.categoryLabel && String(d.categoryLabel).trim()) {
                this._setTitle(d.categoryLabel);
            } else if (d.query != null && String(d.query).trim()) {
                this._setTitle(d.query);
            } else if (d.category && String(d.category).trim()) {
                this._setTitle(d.category);
            }
        });

        window.addEventListener('results-header-title', (e) => {
            const t = e.detail?.title;
            if (t != null && String(t).trim() !== '') {
                this._setTitle(t);
            }
        });
    }
}

customElements.define('app-results-header', ResultsHeader);
