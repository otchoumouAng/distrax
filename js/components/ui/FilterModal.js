export class FilterModal extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <style>
                .premium-modal-content {
                    position: absolute; bottom: 0; left: 0; right: 0;
                    background: var(--bg-main);
                    border-top: 1px solid color-mix(in srgb, var(--text-main) 15%, transparent);
                    border-radius: 32px 32px 0 0;
                    padding: 32px 24px;
                    max-height: 88svh;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    transform: translateY(100%);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 -20px 60px rgba(0,0,0,0.8);
                }
                .premium-modal-content::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 100%;
                    border-radius: 32px 32px 0 0; border: 1px solid rgba(255,255,255,0.05); pointer-events: none;
                }
                .premium-input, .premium-select {
                    width: 100%; padding: 16px; border-radius: 16px; 
                    border: 1px solid var(--border-light); 
                    background-color: var(--bg-main); 
                    color: var(--text-main); font-family: inherit; font-size: 16px;
                    transition: all 0.3s ease;
                }
                .premium-select { 
                    appearance: none; -webkit-appearance: none;
                    background-image: url('data:image/svg+xml;utf8,<svg fill="%2394a3b8" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'); 
                    background-repeat: no-repeat; background-position-x: 95%; background-position-y: 50%; 
                }
                .premium-input:focus, .premium-select:focus {
                    outline: none; border-color: var(--primary);
                    background-color: var(--bg-card);
                    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent);
                }
                [data-theme="dark"] .premium-input, 
                [data-theme="dark"] .premium-select {
                    border: 1px solid color-mix(in srgb, var(--text-main) 15%, transparent); 
                    background-color: color-mix(in srgb, var(--text-main) 5%, var(--bg-card));
                }
                [data-theme="dark"] .premium-select { 
                    background-image: url('data:image/svg+xml;utf8,<svg fill="%2371717a" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'); 
                }
                @media (prefers-color-scheme: dark) {
                    :root:not([data-theme="light"]) .premium-input,
                    :root:not([data-theme="light"]) .premium-select {
                        border: 1px solid color-mix(in srgb, var(--text-main) 15%, transparent); 
                        background-color: color-mix(in srgb, var(--text-main) 5%, var(--bg-card));
                    }
                    :root:not([data-theme="light"]) .premium-select { 
                        background-image: url('data:image/svg+xml;utf8,<svg fill="%2371717a" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'); 
                    }
                }
                .custom-select-container { position: relative; width: 100%; }
                .custom-select-trigger { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
                .custom-select-option:hover { background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
                .custom-select-option.selected { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); font-weight: bold; }
            </style>
            <div class="filter-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; backdrop-filter: blur(8px); transition: opacity 0.3s ease;">
                <div class="filter-modal-content premium-modal-content">
                    
                    <div style="width: 48px; height: 5px; background: var(--border-light); border-radius: 10px; margin: 0 auto 28px;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                        <div>
                            <h3 style="font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0; letter-spacing: -0.5px;">Filtres</h3>
                            <p style="color: var(--text-light); font-size: 14px; margin: 4px 0 0 0;">Affinez votre exploration</p>
                        </div>
                        <button class="close-modal-btn" style="background: var(--bg-card); border: 1px solid var(--border-light); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-main); box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.2s;">
                            <i class="material-icons-round" style="font-size: 20px;">close</i>
                        </button>
                    </div>

                    <div class="filter-group" style="margin-bottom: 28px;">
                        <label style="display: block; font-weight: 700; color: var(--text-main); margin-bottom: 12px; font-size: 15px;">Catégorie</label>
                        <div class="custom-select-container" id="filterCategoryDropdown">
                            <div class="custom-select-trigger premium-input" id="filterCategoryTrigger">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i class="material-icons-round" id="filterCategorySelectedIcon" style="display:none; color:var(--primary); font-size:20px;"></i>
                                    <span class="selected-label" id="filterCategorySelectedLabel">Toutes les catégories</span>
                                </div>
                                <i class="material-icons-round" style="color:var(--text-muted); font-size:20px; transition:transform 0.3s;" id="filterCategoryChevron">expand_more</i>
                            </div>
                            <div class="custom-select-options" id="filterCategoryOptions" style="display: none; position:absolute; left:0; right:0; top:calc(100% + 8px); background:var(--bg-main); border:1px solid var(--border-light); border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.1); z-index:100; max-height:220px; overflow-y:auto; padding:8px;">
                                <div class="custom-select-option selected" data-value="" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:8px; cursor:pointer; color:var(--text-main);">
                                    <span style="font-weight:500;">Toutes les catégories</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="filterCategorySelect" value="">
                    </div>

                    <div class="filter-group" style="margin-bottom: 28px;">
                        <label style="display: block; font-weight: 700; color: var(--text-main); margin-bottom: 12px; font-size: 15px;">Mots-clés</label>
                        <input type="text" class="premium-input" id="filterKeywordsInput" placeholder="Ex: Football, Café, Cinéma...">
                    </div>

                    <div class="filter-group" style="margin-bottom: 28px;">
                        <label style="display: block; font-weight: 700; color: var(--text-main); margin-bottom: 12px; font-size: 15px;">Date</label>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;" id="filterDateGroup">
                            <filter-pill icon="event" active interactive data-date="today">Aujourd'hui</filter-pill>
                            <filter-pill icon="calendar_today" interactive data-date="tomorrow">Demain</filter-pill>
                            <filter-pill icon="date_range" interactive data-date="weekend">Ce week-end</filter-pill>
                        </div>
                    </div>

                    <div class="filter-group" style="margin-bottom: 28px;">
                        <label style="display: block; font-weight: 700; color: var(--text-main); margin-bottom: 12px; font-size: 15px;">Prix</label>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;" id="filterPriceGroup">
                            <filter-pill icon="payments" interactive data-price-type="free">Gratuit</filter-pill>
                            <filter-pill icon="credit_card" interactive data-price-type="paid">Payant</filter-pill>
                            <filter-pill icon="volunteer_activism" interactive data-price-type="contribution">Libre</filter-pill>
                        </div>
                    </div>

                    <div class="filter-group" style="margin-bottom: 40px;">
                        <label style="display: block; font-weight: 700; color: var(--text-main); margin-bottom: 12px; font-size: 15px;">Commune</label>
                        <select class="premium-select" id="filterCommuneSelect">
                            <option value="">Toutes les communes</option>
                        </select>
                    </div>

                    <button class="apply-filters-btn" style="width: 100%; padding: 18px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 16px; cursor: pointer; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); transition: transform 0.2s, box-shadow 0.2s; letter-spacing: 0.5px;">
                        Afficher les résultats
                    </button>
                    
                </div>
            </div>
        `;

        this.overlay = this.querySelector('.filter-modal-overlay');
        this.content = this.querySelector('.filter-modal-content');

        this.setupListeners();
    }

    setupListeners() {
        this.querySelector('.close-modal-btn').addEventListener('click', () => this.close());
        this.querySelector('.apply-filters-btn').addEventListener('click', () => this._applyFilters());

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Gestion de l'exclusivité des filtres dans chaque groupe
        // On écoute 'filter-toggled' plutôt que 'click' pour éviter
        // le conflit avec le re-rendu interne de FilterPill
        const filterGroups = this.querySelectorAll('.filter-group');
        filterGroups.forEach(group => {
            const pills = group.querySelectorAll('filter-pill[interactive]');
            pills.forEach(pill => {
                pill.addEventListener('filter-toggled', (e) => {
                    const isNowActive = e.detail.active;
                    // Exclusivité : si cette pill vient d'être activée, désactiver les autres
                    if (isNowActive) {
                        pills.forEach(p => {
                            if (p !== pill) p.removeAttribute('active');
                        });
                    }
                });
            });
        });

        // Écouter l'ouverture des filtres depuis l'extérieur
        document.addEventListener('open-filters', () => this.open());
        document.addEventListener('filters-cleared', () => this.reset());

        // Setup category dropdown
        const catTrigger = this.querySelector('#filterCategoryTrigger');
        const catOptions = this.querySelector('#filterCategoryOptions');
        const catHidden = this.querySelector('#filterCategorySelect');
        const catLabel = this.querySelector('#filterCategorySelectedLabel');
        const catIcon = this.querySelector('#filterCategorySelectedIcon');
        const catChevron = this.querySelector('#filterCategoryChevron');

        if (catTrigger && catOptions) {
            catTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = catOptions.style.display === 'block';
                catOptions.style.display = isOpen ? 'none' : 'block';
                catChevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            });

            catOptions.addEventListener('click', (e) => {
                const opt = e.target.closest('.custom-select-option');
                if (!opt) return;
                const val = opt.dataset.value;
                const label = opt.dataset.label || 'Toutes les catégories';
                const icon = opt.dataset.icon;

                catHidden.value = val;
                catLabel.textContent = label;
                if (icon) {
                    catIcon.textContent = icon;
                    catIcon.style.display = 'block';
                } else {
                    catIcon.style.display = 'none';
                }

                catOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');

                catOptions.style.display = 'none';
                catChevron.style.transform = 'rotate(0deg)';
            });

            document.addEventListener('click', (e) => {
                if (!catTrigger.contains(e.target) && !catOptions.contains(e.target)) {
                    catOptions.style.display = 'none';
                    catChevron.style.transform = 'rotate(0deg)';
                }
            });
        }
    }

    reset() {
        const query = this.querySelector('#filterKeywordsInput');
        if (query) query.value = '';

        const catHidden = this.querySelector('#filterCategorySelect');
        const catLabel = this.querySelector('#filterCategorySelectedLabel');
        const catIcon = this.querySelector('#filterCategorySelectedIcon');
        const catOptions = this.querySelector('#filterCategoryOptions');
        if (catHidden) catHidden.value = '';
        if (catLabel) catLabel.textContent = 'Toutes les catégories';
        if (catIcon) catIcon.style.display = 'none';
        if (catOptions) {
            catOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            const firstOpt = catOptions.querySelector('.custom-select-option');
            if (firstOpt) firstOpt.classList.add('selected');
        }

        const communeSelect = this.querySelector('#filterCommuneSelect');
        if (communeSelect) communeSelect.value = '';

        this.querySelectorAll('filter-pill[active]').forEach(p => p.removeAttribute('active'));
    }

    _applyFilters() {
        const query = (this.querySelector('#filterKeywordsInput')?.value || '').trim();
        const communeSelect = this.querySelector('#filterCommuneSelect');
        const commune = communeSelect?.value?.trim() || null;
        const categorySelect = this.querySelector('#filterCategorySelect');
        const category = categorySelect?.value?.trim() || null;

        let price_type = null;
        const priceGroup = this.querySelector('#filterPriceGroup');
        if (priceGroup) {
            const activePrice = priceGroup.querySelector('filter-pill[active]');
            if (activePrice && activePrice.dataset.priceType) price_type = activePrice.dataset.priceType;
        }

        let date = null;
        const dateGroup = this.querySelector('#filterDateGroup');
        if (dateGroup) {
            const activeDate = dateGroup.querySelector('filter-pill[active]');
            if (activeDate && activeDate.dataset.date) date = activeDate.dataset.date;
        }

        this.close();
        document.dispatchEvent(new CustomEvent('apply-filters', {
            bubbles: true,
            composed: true,
            detail: { query: query || null, commune, category, price_type, date }
        }));
    }

    async _loadCommunes() {
        const select = this.querySelector('#filterCommuneSelect');
        if (!select || select.options.length > 1) return;
        try {
            const { api } = await import('../../api.js');
            const communes = await api.getCommunes();
            if (Array.isArray(communes) && communes.length > 0) {
                select.innerHTML = '<option value="">Toutes les communes</option>';
                communes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('[FilterModal] Communes non chargées:', e.message);
        }
    }

    async _loadCategories() {
        const optionsContainer = this.querySelector('#filterCategoryOptions');
        if (!optionsContainer || optionsContainer.children.length > 1) return;
        try {
            const { api } = await import('../../api.js');
            const categories = await api.getCategoriesFull();
            if (Array.isArray(categories) && categories.length > 0) {
                optionsContainer.innerHTML = '<div class="custom-select-option selected" data-value="" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:8px; cursor:pointer; color:var(--text-main);"><span style="font-weight:500;">Toutes les catégories</span></div>';
                const sorted = categories.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
                sorted.forEach(c => {
                    optionsContainer.innerHTML += `<div class="custom-select-option" data-value="${c.slug}" data-label="${c.label}" data-icon="${c.icon}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:8px; cursor:pointer; color:var(--text-main);">
                        <i class="material-icons-round" style="color:var(--primary); font-size:20px;">${c.icon}</i>
                        <span style="font-weight:500;">${c.label}</span>
                    </div>`;
                });
            }
        } catch (e) {
            console.warn('[FilterModal] Catégories non chargées:', e.message);
        }
    }

    open() {
        this._loadCommunes();
        this._loadCategories();
        this.overlay.style.display = 'block';
        // Forcer le reflow
        this.overlay.offsetHeight;
        this.content.style.transform = 'translateY(0)';
        document.body.style.overflow = 'hidden'; // Empêche le défilement de la page en arrière-plan
    }

    close() {
        this.content.style.transform = 'translateY(100%)';
        document.body.style.overflow = ''; // Restaure le défilement
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 300);
    }
}

customElements.define('app-filter-modal', FilterModal);
