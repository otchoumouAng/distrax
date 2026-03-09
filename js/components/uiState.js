export class UIStateManager {
    constructor(elements) {
        this.elements = elements;
        this.isResultsMode = false;
    }

    triggerResultsTransition(query, iconName) {
        this.isResultsMode = true;
        this.elements.headerTitle.textContent = query;
        this.elements.headerIcon.innerHTML = `<i class="material-icons-round">${iconName}</i>`;
        document.body.classList.add('state-results');
        this.elements.searchContainer.classList.remove('active');
        this.elements.searchBox.classList.remove('active');
        this.elements.floatingNav.style.display = 'none';

        this.elements.skeletonsWrapper.style.display = 'flex';
        this.elements.skeletonsWrapper.style.opacity = '1';
        this.elements.cardsWrapper.style.display = 'none';

        setTimeout(() => {
            this.elements.skeletonsWrapper.style.opacity = '0';
            setTimeout(() => {
                this.elements.skeletonsWrapper.style.display = 'none';
                this.elements.cardsWrapper.style.display = 'flex';
            }, 400);
        }, 1200);
    }

    backToSearch() {
        this.isResultsMode = false;
        document.body.classList.remove('state-results');
        this.elements.floatingNav.style.display = 'flex';
    }

    backToHome() {
        this.isResultsMode = false;
        document.body.classList.remove('state-results');
        this.elements.floatingNav.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
