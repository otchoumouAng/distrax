import { escapeHtml } from '../../utils/escapeHtml.js';

export class FilterPill extends HTMLElement {
    constructor() {
        super();
        this.isActive = this.hasAttribute('active');
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const icon = this.getAttribute('icon') || '';

        // Capturer le label UNE SEULE FOIS depuis le slot initial
        // Après render(), textContent contiendra aussi le nom d'icône → utiliser data-label
        if (!this.dataset.label) {
            this.dataset.label = this.getAttribute('text') || this.textContent.trim() || 'Filtre';
        }
        const text = this.dataset.label;

        const isInteractive = this.hasAttribute('interactive') || this.hasAttribute('toggleable');

        const iconHtml = icon ? `<i class="material-icons-round">${escapeHtml(icon)}</i> ` : '';
        const toggleClass = isInteractive ? ' interactive-toggle' : '';
        const activeClass = this.isActive ? ' active' : '';

        this.innerHTML = `<button class="filter-pill${toggleClass}${activeClass}">${iconHtml}${escapeHtml(text)}</button>`;
        this.btn = this.querySelector('button');

        if (isInteractive) {
            this.btn.addEventListener('click', () => this.toggleState());
        } else {
            this.btn.addEventListener('click', () => {
                const event = new CustomEvent('filter-clicked', {
                    detail: { text, active: this.isActive },
                    bubbles: true,
                    composed: true
                });
                this.dispatchEvent(event);
            });
        }
    }

    toggleState() {
        this.isActive = !this.isActive;
        this.updateUI();

        // Dispatch event when state changes
        const event = new CustomEvent('filter-toggled', {
            detail: {
                text: this.getAttribute('text') || this.textContent.trim(),
                active: this.isActive
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    updateUI() {
        if (this.isActive) {
            this.btn.classList.add('active');
            this.setAttribute('active', '');
        } else {
            this.btn.classList.remove('active');
            this.removeAttribute('active');
        }
    }

    static get observedAttributes() {
        return ['active', 'icon', 'text'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'active') {
            const isNowActive = newValue !== null;
            if (this.isActive !== isNowActive) {
                this.isActive = isNowActive;
                if (this.btn) this.updateUI();
            }
        } else if (oldValue !== newValue && this.isConnected) {
            this.render();
        }
    }
}

customElements.define('filter-pill', FilterPill);
