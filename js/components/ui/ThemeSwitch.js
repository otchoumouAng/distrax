export class ThemeSwitch extends HTMLElement {
    constructor() {
        super();
        this.currentTheme = localStorage.getItem('dystrax-theme') || 'light';
    }

    connectedCallback() {
        this.innerHTML = `
            <button class="theme-toggle-btn" aria-label="Bascule de thème" title="Changer le thème">
                <i class="material-icons-round theme-icon">
                    ${this.currentTheme === 'dark' ? 'dark_mode' : 'light_mode'}
                </i>
            </button>
        `;

        // Appliquer le thème initial
        this.applyTheme(this.currentTheme);

        this.btn = this.querySelector('.theme-toggle-btn');
        this.icon = this.querySelector('.theme-icon');

        this.btn.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.icon.textContent = this.currentTheme === 'dark' ? 'dark_mode' : 'light_mode';

        // Animation du bouton
        this.icon.style.transform = 'rotate(180deg) scale(0)';
        setTimeout(() => {
            this.icon.style.transform = 'rotate(0deg) scale(1)';
        }, 150);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('dystrax-theme', theme);

        // Notifier le reste de l'app si nécessaire
        this.dispatchEvent(new CustomEvent('theme-changed', {
            detail: { theme },
            bubbles: true,
            composed: true
        }));
    }
}

customElements.define('app-theme-switch', ThemeSwitch);
