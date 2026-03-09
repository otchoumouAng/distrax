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
                        <div class="header-icon" id="headerIcon"><i class="material-icons-round">search</i></div>
                        <h1 class="header-title" id="headerTitle">...</h1>
                    </div>
                    <button class="edit-btn" id="editBtn" title="Modifier la recherche">
                        <i class="material-icons-round">edit</i><span>Modifier</span>
                    </button>
                </div>
            </header>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const backBtn = this.querySelector('#resultsBackBtn');
        const editBtn = this.querySelector('#editBtn');

        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('navigate-back', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('edit-search', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        // Listen for search changes to update title
        window.addEventListener('recherche-validee', (e) => {
            const titleElement = this.querySelector('#headerTitle');
            if (titleElement && e.detail && e.detail.query) {
                titleElement.textContent = e.detail.query;
            }
        });
    }
}

customElements.define('app-results-header', ResultsHeader);
