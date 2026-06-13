import { TypewriterEffect } from '../animations.js';

export class HomeHero extends HTMLElement {
    constructor() {
        super();
        this._scrollRaf = null;
        this._onScroll = null;
        this._onResize = null;
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="home-hero" id="homeHero">
                <div class="search-container" id="searchContainer">
                    <div class="hero-section-wrapper">
                        <div class="hero-section">
                            <div class="logo-box" style="background: transparent;">
                                <img src="assets/img/logo.png" alt="Dystrax" style="width: 100%; height: 100%; object-fit: contain; border-radius: inherit;">
                            </div>
                            <p class="hero-text">De quoi avez-vous besoin aujourd'hui ?</p>
                        </div>
                    </div>

                    <div class="search-box" id="searchBox" style="cursor: text;">
                        <div class="search-inner" id="searchForm">
                            <i class="material-icons-round search-icon">search</i>

                            <input type="text" class="search-input" id="searchInput" autocomplete="off" autocorrect="off"
                                spellcheck="false" role="combobox" aria-expanded="false"
                                aria-label="Que voulez-vous faire ?" readonly style="cursor: text;">

                            <div class="typewriter-cursor" id="cursor"></div>
                            <div class="icons-container" id="actionsContainer">
                                <button type="button" class="action-btn mic-btn" id="micBtn"
                                    aria-label="Recherche vocale"><i class="material-icons-round">mic</i></button>
                            </div>
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
            searchInput: this.querySelector('#searchInput'),
            scrollIndicator: this.querySelector('#scrollIndicator')
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

    initEvents() {
        const navigateToSearch = () => {
            document.dispatchEvent(new CustomEvent('navigate-search', { bubbles: true, composed: true }));
        };

        this.elements.searchBox.addEventListener('click', navigateToSearch);
        this.elements.searchInput.addEventListener('focus', navigateToSearch);

        this.elements.scrollIndicator.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('scroll-to-explore', { bubbles: true, composed: true }));
        });
    }
}

customElements.define('app-home-hero', HomeHero);
