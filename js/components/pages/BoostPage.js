/**
 * BoostPage — Sélection de la durée, zone et options du boost.
 * - Charge les plans depuis GET /api/v1/boosts/plans
 * - Calcule le prix dynamiquement (plan × zone multiplier)
 * - Active le boost via POST /api/v1/boosts
 */
export class BoostPage extends HTMLElement {
    constructor() {
        super();
        this._plans   = [];
        this._options = [];           // options chargées depuis l'API
        this._selectedPlanId = null;
        this._selectedZone   = 'commune';
        this._desireId       = null;
    }

    connectedCallback() {
        this.innerHTML = `
            <section class="page-section boost-page" id="boostPage" style="display: none; height: 100svh; overflow-y: auto; overflow-x: hidden;">

                <!-- Header -->
                <header class="boost-header">
                    <button class="round-icon-btn back-from-boost" aria-label="Retour">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div class="boost-header-text">
                        <span class="boost-header-title">Booster une envie</span>
                        <span class="boost-header-sub">Trouvez vos partenaires rapidement</span>
                    </div>
                </header>

                <div class="boost-body">

                    <!-- Carte résumé de l'envie -->
                    <div class="boost-desire-preview" id="boostDesirePreview">
                        <div class="boost-desire-icon">
                            <i class="material-icons-round">explore</i>
                        </div>
                        <div class="boost-desire-info">
                            <p class="boost-desire-title" id="boostDesireTitle">Sélectionnez une envie à booster</p>
                            <p class="boost-desire-meta" id="boostDesireMeta">
                                <i class="material-icons-round">rocket_launch</i> Boost actif
                            </p>
                        </div>
                    </div>

                    <!-- Section : Choisir la durée (rendu dynamique depuis l'API) -->
                    <div class="boost-section">
                        <h3 class="boost-section-title">Durée du boost</h3>
                        <p class="boost-section-desc">Pendant combien de temps souhaitez-vous booster votre envie ?</p>
                        <div class="boost-duration-grid" id="boostPlansContainer">
                            <!-- Skeletons -->
                            <div class="boost-duration-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 90px;"></div>
                            <div class="boost-duration-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 90px;"></div>
                            <div class="boost-duration-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 90px;"></div>
                        </div>
                    </div>

                    <!-- Section : Zone de diffusion -->
                    <div class="boost-section">
                        <h3 class="boost-section-title">Zone de diffusion</h3>
                        <p class="boost-section-desc">À qui montrer votre envie en priorité ?</p>
                        <div class="boost-zone-list" id="boostZonesContainer">
                            <!-- Skeletons — remplacés par loadZones() -->
                            <div class="boost-radio-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 60px; pointer-events: none;"></div>
                            <div class="boost-radio-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 60px; pointer-events: none;"></div>
                            <div class="boost-radio-card" style="animation: pulse 1.4s ease-in-out infinite; min-height: 60px; pointer-events: none;"></div>
                        </div>
                    </div>

                    <!-- Section: Options (fixes + dynamiques depuis l'API) -->
                    <div class="boost-section">
                        <h3 class="boost-section-title">Options</h3>
                        <div class="boost-toggles-list" id="boostOptionsContainer">
                            <!-- Options fixes toujours présentes -->
                            <div class="boost-toggle-row">
                                <div class="boost-toggle-info">
                                    <i class="material-icons-round">notifications_active</i>
                                    <div>
                                        <span class="boost-toggle-title">Notifier les intéressés</span>
                                        <span class="boost-toggle-sub">Envoyer une notification aux pers. similaires</span>
                                    </div>
                                </div>
                                <label class="boost-switch">
                                    <input type="checkbox" checked id="notifyToggle">
                                    <span class="boost-switch-track"></span>
                                </label>
                            </div>
                            <div class="boost-toggle-row">
                                <div class="boost-toggle-info">
                                    <i class="material-icons-round">star</i>
                                    <div>
                                        <span class="boost-toggle-title">Position prioritaire</span>
                                        <span class="boost-toggle-sub">Apparaître en haut des résultats</span>
                                    </div>
                                </div>
                                <label class="boost-switch">
                                    <input type="checkbox" checked id="priorityToggle">
                                    <span class="boost-switch-track"></span>
                                </label>
                            </div>
                            <!-- Options dynamiques chargées depuis l'API (ex: Boost RS) -->
                            <div id="boostDynamicOptions">
                                <!-- Skeleton -->
                                <div class="boost-toggle-row" style="opacity:0.4; pointer-events:none; animation: pulse 1.4s ease-in-out infinite;">
                                    <div class="boost-toggle-info" style="flex:1;">
                                        <i class="material-icons-round">hourglass_empty</i>
                                        <div><span class="boost-toggle-title">Chargement…</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Récapitulatif prix dynamique -->
                    <div class="boost-summary-card">
                        <div class="boost-summary-row">
                            <span id="summaryPlanLabel">Plan sélectionné</span>
                            <span id="summaryPlanPrice">—</span>
                        </div>
                        <div class="boost-summary-row" id="summaryZoneRow">
                            <span id="summaryZoneDesc">Zone de base</span>
                            <span id="summaryZoneExtra" style="color:var(--text-muted);">Inclus</span>
                        </div>
                        <div class="boost-summary-row">
                            <span>Position prioritaire</span>
                            <span class="boost-summary-free">Inclus</span>
                        </div>
                        <!-- Lignes dynamiques pour les options choisies -->
                        <div id="summaryOptionsRows"></div>
                        <div class="boost-summary-divider"></div>
                        <div class="boost-summary-row boost-summary-total">
                            <span>Total</span>
                            <span id="boostTotalPrice">—</span>
                        </div>
                    </div>

                    <!-- CTA principal -->
                    <button class="boost-launch-btn" id="boostLaunchBtn">
                        <i class="material-icons-round">rocket_launch</i>
                        Lancer le boost
                    </button>

                    <div style="height: 40px;"></div>
                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    // ── Chargement des plans depuis l'API ─────────────────────────
    async loadPlans() {
        try {
            // Vérifier si la feature boost_plans est active
            const { isFeatureEnabled } = await import('../../utils/featureFlags.js');
            const plansEnabled = await isFeatureEnabled('boost_plans');
            if (!plansEnabled) {
                const container = this.querySelector('#boostPlansContainer');
                if (container) {
                    container.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; padding: 16px 0; grid-column: 1/-1;">Les plans de boost ne sont pas disponibles actuellement.</p>`;
                }
                const launchBtn = this.querySelector('#boostLaunchBtn');
                if (launchBtn) launchBtn.disabled = true;
                return;
            }

            const { api } = await import('../../api.js');
            const plans = await api.getBoostPlans();
            this._plans = plans;
            this._selectedPlanId = plans.find(p => p.popular)?.id || plans[0]?.id;

            const container = this.querySelector('#boostPlansContainer');
            container.innerHTML = plans.map((plan, i) => `
                <button class="boost-duration-card ${plan.id === this._selectedPlanId ? 'boost-selected' : ''}" 
                    data-plan-id="${plan.id}"
                    data-base-price="${plan.price_xof}"
                    data-duration-hours="${plan.duration_hours}"
                    data-label="${plan.label}">
                    ${plan.popular ? '<span class="boost-badge-popular">Populaire</span>' : ''}
                    <span class="boost-duration-val">${plan.id}</span>
                    <span class="boost-duration-label">${plan.label}</span>
                    <span class="boost-duration-price">${plan.price_xof === 0 ? 'Gratuit' : plan.price_xof.toLocaleString('fr-FR') + ' FCFA'}</span>
                </button>
            `).join('');

            // Réattacher les listeners sur les nouvelles cards
            this._attachPlanListeners();
            this._refreshZonePrices(); // mettre à jour les prix FCFA des zones
            this._updateSummary();
        } catch (err) {
            console.warn('Plans de boost non chargés :', err.message);
        }
    }

    // ── Chargement des zones depuis l'API ─────────────────────────
    async loadZones() {
        try {
            const { api } = await import('../../api.js');
            const zones = await api.getBoostZones();
            const container = this.querySelector('#boostZonesContainer');
            if (!container || !zones?.length) return;

            const zoneIcons  = { commune: 'location_city', tout_abidjan: 'location_on', cote_divoire: 'public' };
            const zoneDescs  = ['Zone de base', 'Audience plus large', 'Couverture nationale'];

            container.innerHTML = zones.map((z, idx) => `
                <label class="boost-radio-card ${idx === 0 ? 'boost-selected' : ''}"
                    data-zone="${z.id}"
                    data-multiplier="${z.price_multiplier}">
                    <input type="radio" name="zone" value="${z.id}" ${idx === 0 ? 'checked' : ''}>
                    <div class="boost-radio-icon"><i class="material-icons-round">${zoneIcons[z.id] || 'place'}</i></div>
                    <div class="boost-radio-info">
                        <span class="boost-radio-title">${z.label}</span>
                        <span class="boost-radio-sub">${zoneDescs[idx] ?? ''}</span>
                        <span class="boost-zone-price" style="font-size:13px;font-weight:700;color:var(--primary,#6366f1);margin-top:2px;">—</span>
                    </div>
                    <i class="material-icons-round boost-radio-check">check_circle</i>
                </label>
            `).join('');

            // Premier zone sélectionné par défaut
            if (zones[0]) this._selectedZone = zones[0].id;

            this._attachZoneListeners();
            this._refreshZonePrices(); // afficher les prix FCFA dès le rendu
            this._updateSummary();
        } catch (err) {
            console.warn('[BoostPage] Zones non chargées:', err.message);
            // Fallback statique
            const container = this.querySelector('#boostZonesContainer');
            if (container) {
                container.innerHTML = `
                    <label class="boost-radio-card boost-selected" data-zone="commune" data-multiplier="1.0">
                        <input type="radio" name="zone" value="commune" checked>
                        <div class="boost-radio-icon"><i class="material-icons-round">location_city</i></div>
                        <div class="boost-radio-info">
                            <span class="boost-radio-title">Ma commune</span>
                            <span class="boost-radio-sub">Zone de base</span>
                            <span class="boost-zone-price" style="font-size:13px;font-weight:700;color:var(--primary,#6366f1);margin-top:2px;">—</span>
                        </div>
                        <i class="material-icons-round boost-radio-check">check_circle</i>
                    </label>
                    <label class="boost-radio-card" data-zone="tout_abidjan" data-multiplier="1.5">
                        <input type="radio" name="zone" value="tout_abidjan">
                        <div class="boost-radio-icon"><i class="material-icons-round">location_on</i></div>
                        <div class="boost-radio-info">
                            <span class="boost-radio-title">Tout Abidjan</span>
                            <span class="boost-radio-sub">Audience plus large</span>
                            <span class="boost-zone-price" style="font-size:13px;font-weight:700;color:var(--primary,#6366f1);margin-top:2px;">—</span>
                        </div>
                        <i class="material-icons-round boost-radio-check">check_circle</i>
                    </label>
                    <label class="boost-radio-card" data-zone="cote_divoire" data-multiplier="2.0">
                        <input type="radio" name="zone" value="cote_divoire">
                        <div class="boost-radio-icon"><i class="material-icons-round">public</i></div>
                        <div class="boost-radio-info">
                            <span class="boost-radio-title">Côte d'Ivoire</span>
                            <span class="boost-radio-sub">Couverture nationale</span>
                            <span class="boost-zone-price" style="font-size:13px;font-weight:700;color:var(--primary,#6366f1);margin-top:2px;">—</span>
                        </div>
                        <i class="material-icons-round boost-radio-check">check_circle</i>
                    </label>`;
                this._attachZoneListeners();
                this._refreshZonePrices();
            }
        }
    }

    // ── Chargement des options depuis l'API ───────────────────
    async loadOptions() {
        const container = this.querySelector('#boostDynamicOptions');
        if (!container) return;

        try {
            const { api } = await import('../../api.js');
            const options = await api.getBoostOptions();
            this._options = options;

            if (!options || options.length === 0) {
                container.innerHTML = '';
                return;
            }

            // Icônes SVG inline pour les réseaux sociaux (Material Icons ne les a pas)
            const socialIcons = {
                facebook:  `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
                instagram: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
                tiktok:    `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.88-3.28c.28 0 .54.04.79.1V9.01A6.34 6.34 0 0 0 3.94 15.3a6.34 6.34 0 0 0 12.67.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.8-.07z"/></svg>`,
            };

            container.innerHTML = options.map(opt => {
                const snsHtml = opt.social_networks?.length
                    ? opt.social_networks.map(sn => `
                        <span style="display:inline-flex;align-items:center;gap:3px;background:var(--bg-main);border:1px solid var(--border-light);border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600;">
                            ${socialIcons[sn.slug] || ''}${sn.label}
                        </span>`).join('')
                    : '';

                const zoneSurcharge = opt.zone_surcharges?.[this._selectedZone] ?? 0;
                const pricePerDay   = opt.base_price_xof + zoneSurcharge;
                const priceStr      = pricePerDay === 0 ? 'Gratuit' : `${pricePerDay.toLocaleString('fr-FR')} FCFA/jour`;

                return `
                    <div class="boost-toggle-row" data-option-slug="${opt.slug}" style="flex-direction:column;align-items:stretch;gap:0;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div class="boost-toggle-info" style="flex:1;">
                                <i class="material-icons-round">${opt.icon || 'star'}</i>
                                <div>
                                    <span class="boost-toggle-title">${opt.label}</span>
                                    <span class="boost-toggle-sub" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px;">
                                        ${snsHtml}
                                        <span class="boost-option-price" style="font-size:12px;font-weight:700;color:var(--primary,#6366f1);">
                                            ${priceStr}
                                        </span>
                                    </span>
                                </div>
                            </div>
                            <label class="boost-switch" style="flex-shrink:0;">
                                <input type="checkbox" class="boost-option-toggle" data-option-slug="${opt.slug}">
                                <span class="boost-switch-track"></span>
                            </label>
                        </div>

                        <!-- Compteur de jours — visible uniquement si l'option est activée -->
                        <div class="boost-option-days" style="
                            display:none; align-items:center; justify-content:space-between;
                            margin-top:12px; padding:12px 14px;
                            background:var(--bg-main); border-radius:14px;
                            border:1.5px solid var(--primary,#6366f1);
                        ">
                            <div style="display:flex;flex-direction:column;gap:2px;">
                                <span style="font-size:12px;color:var(--text-muted);font-weight:500;">Durée de diffusion</span>
                                <span class="boost-day-total" style="font-size:13px;font-weight:700;color:var(--primary,#6366f1);">
                                    ${pricePerDay.toLocaleString('fr-FR')} FCFA
                                </span>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <button class="boost-day-btn" data-action="minus" style="
                                    width:34px;height:34px;border-radius:50%;
                                    border:2px solid var(--border-light);
                                    background:var(--bg-card);cursor:pointer;
                                    font-size:20px;font-weight:700;line-height:1;
                                    display:flex;align-items:center;justify-content:center;
                                    color:var(--text-main);">−</button>

                                <div style="text-align:center;min-width:52px;">
                                    <span class="boost-day-value" data-days="1"
                                        style="font-size:20px;font-weight:800;color:var(--text-main);">1</span>
                                    <span style="font-size:12px;color:var(--text-muted);margin-left:2px;">jour(s)</span>
                                </div>

                                <button class="boost-day-btn" data-action="plus" style="
                                    width:34px;height:34px;border-radius:50%;border:none;
                                    background:var(--primary,#6366f1);cursor:pointer;
                                    font-size:20px;font-weight:700;line-height:1;
                                    display:flex;align-items:center;justify-content:center;
                                    color:#fff;">+</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Attacher les listeners pour chaque option
            options.forEach(opt => {
                const row     = container.querySelector(`[data-option-slug="${opt.slug}"]`);
                if (!row) return;
                const toggle  = row.querySelector('.boost-option-toggle');
                const counter = row.querySelector('.boost-option-days');
                const dayValEl   = row.querySelector('.boost-day-value');
                const dayTotalEl = row.querySelector('.boost-day-total');
                const priceEl    = row.querySelector('.boost-option-price');

                // Afficher/masquer le compteur selon le toggle
                toggle?.addEventListener('change', () => {
                    if (counter) counter.style.display = toggle.checked ? 'flex' : 'none';
                    this._updateSummary();
                });

                // Boutons + et −
                row.querySelectorAll('.boost-day-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        let days = parseInt(dayValEl?.dataset.days || '1');
                        days = btn.dataset.action === 'plus' ? Math.min(days + 1, 90) : Math.max(days - 1, 1);
                        if (dayValEl) { dayValEl.dataset.days = days; dayValEl.textContent = days; }

                        // Mettre à jour le total affiché dans le compteur
                        const zoneSurcharge = opt.zone_surcharges?.[this._selectedZone] ?? 0;
                        const price = (opt.base_price_xof + zoneSurcharge) * days;
                        if (dayTotalEl) dayTotalEl.textContent = `${price.toLocaleString('fr-FR')} FCFA`;

                        this._updateSummary();
                    });
                });
            });

        } catch (err) {
            if (container) container.innerHTML = '';
        }
    }

    /**
     * Met à jour le prix/jour affiché dans chaque option lorsque la zone change.
     * (La durée est gérée par le compteur, donc seul le prix de base change.)
     */
    _refreshOptionPrices() {
        if (!this._options?.length) return;
        this._options.forEach(opt => {
            const row = this.querySelector(`[data-option-slug="${opt.slug}"]`);
            if (!row) return;
            const zoneSurcharge = opt.zone_surcharges?.[this._selectedZone] ?? 0;
            const pricePerDay   = opt.base_price_xof + zoneSurcharge;

            // Prix/jour dans le header du toggle
            const priceEl = row.querySelector('.boost-option-price');
            if (priceEl) priceEl.textContent = pricePerDay === 0
                ? 'Gratuit'
                : `${pricePerDay.toLocaleString('fr-FR')} FCFA/jour`;

            // Total dans le compteur (si visible)
            const dayValEl   = row.querySelector('.boost-day-value');
            const dayTotalEl = row.querySelector('.boost-day-total');
            if (dayTotalEl && dayValEl) {
                const days  = parseInt(dayValEl.dataset.days || '1');
                const total = pricePerDay * days;
                dayTotalEl.textContent = `${total.toLocaleString('fr-FR')} FCFA`;
            }
        });
    }

    /**
     * Met à jour le surplus FCFA affiché sur chaque carte de zone selon le plan sélectionné.
     * Surplus = prix_plan × (multiplier − 1) → ce que la zone ajoute par rapport à la commune.
     */
    _refreshZonePrices() {
        const selectedPlanCard = this.querySelector('.boost-duration-card.boost-selected');
        const basePrice = parseInt(selectedPlanCard?.dataset.basePrice || '0');

        this.querySelectorAll('#boostZonesContainer .boost-radio-card').forEach(card => {
            const multiplier = parseFloat(card.dataset.multiplier || '1.0');
            const extra      = Math.round(basePrice * (multiplier - 1.0));
            const priceEl    = card.querySelector('.boost-zone-price');
            if (!priceEl) return;

            if (extra === 0) {
                priceEl.textContent  = 'Prix de base';
                priceEl.style.color  = 'var(--text-muted)';
                priceEl.style.fontWeight = '500';
            } else {
                priceEl.textContent  = `+${extra.toLocaleString('fr-FR')} FCFA`;
                priceEl.style.color  = 'var(--primary,#6366f1)';
                priceEl.style.fontWeight = '700';
            }
        });
    }

    _attachZoneListeners() {
        const radioCards = this.querySelectorAll('#boostZonesContainer .boost-radio-card');
        this.querySelectorAll('#boostZonesContainer input[name="zone"]').forEach(radio => {
            radio.addEventListener('change', () => {
                radioCards.forEach(c => c.classList.remove('boost-selected'));
                const card = radio.closest('.boost-radio-card');
                if (card) card.classList.add('boost-selected');
                this._selectedZone = radio.value;
                this._refreshOptionPrices(); // recalculer les prix des options selon la nouvelle zone
                this._updateSummary();
            });
        });
    }

    _attachPlanListeners() {
        const durationCards = this.querySelectorAll('.boost-duration-card');
        durationCards.forEach(card => {
            card.addEventListener('click', () => {
                durationCards.forEach(c => c.classList.remove('boost-selected'));
                card.classList.add('boost-selected');
                this._selectedPlanId = card.dataset.planId;
                this._refreshZonePrices(); // recalculer les prix FCFA des zones
                this._updateSummary();
            });
        });
    }

    _updateSummary() {
        const selectedCard = this.querySelector('.boost-duration-card.boost-selected');
        if (!selectedCard) return;

        const basePrice = parseInt(selectedCard.dataset.basePrice || '0');
        const label = selectedCard.dataset.label || '';

        // Multiplicateur de zone
        const zoneCard = this.querySelector('#boostZonesContainer .boost-radio-card.boost-selected')
            || this.querySelector('.boost-radio-card.boost-selected');
        const multiplier = parseFloat(zoneCard?.dataset.multiplier || '1.0');
        const zoneName = zoneCard?.querySelector('.boost-radio-title')?.textContent || 'Ma commune';

        // Options dynamiques — durée propre à chaque option (compteur indépendant)
        let optionsExtra = 0;
        const summaryOptionsRows = this.querySelector('#summaryOptionsRows');
        let optionsHtml = '';

        this.querySelectorAll('.boost-option-toggle:checked').forEach(toggle => {
            const slug = toggle.dataset.optionSlug;
            const opt  = (this._options || []).find(o => o.slug === slug);
            if (!opt) return;
            const surcharge  = opt.zone_surcharges?.[this._selectedZone] ?? 0;
            const row        = toggle.closest('.boost-toggle-row');
            const days       = parseInt(row?.querySelector('.boost-day-value')?.dataset.days || '1');
            const price      = (opt.base_price_xof + surcharge) * days;
            optionsExtra    += price;
            const fmt = (n) => n === 0 ? 'Gratuit' : `${n.toLocaleString('fr-FR')} FCFA`;
            optionsHtml += `
                <div class="boost-summary-row">
                    <span>${opt.label} <span style="color:var(--primary,#6366f1);font-size:12px;">×${days}j</span></span>
                    <span>${fmt(price)}</span>
                </div>`;
        });

        if (summaryOptionsRows) summaryOptionsRows.innerHTML = optionsHtml;

        const total = Math.round(basePrice * multiplier) + optionsExtra;

        const fmt = (n) => n === 0 ? 'Gratuit' : `${n.toLocaleString('fr-FR')} FCFA`;

        const labelEl = this.querySelector('#summaryPlanLabel');
        if (labelEl) labelEl.textContent = `Boost ${label}`;

        const planPriceEl = this.querySelector('#summaryPlanPrice');
        if (planPriceEl) planPriceEl.textContent = fmt(basePrice);

        // Zone : afficher la description + le surplus ajouté
        const zoneDesc  = zoneCard?.querySelector('.boost-radio-sub')?.textContent || zoneName;
        const zoneExtra = Math.round(basePrice * (multiplier - 1.0));

        const zoneDescEl  = this.querySelector('#summaryZoneDesc');
        const zoneExtraEl = this.querySelector('#summaryZoneExtra');
        if (zoneDescEl)  zoneDescEl.textContent  = zoneDesc;
        if (zoneExtraEl) {
            if (zoneExtra === 0) {
                zoneExtraEl.textContent = 'Inclus';
                zoneExtraEl.style.color = 'var(--text-muted)';
            } else {
                zoneExtraEl.textContent = `+${zoneExtra.toLocaleString('fr-FR')} FCFA`;
                zoneExtraEl.style.color = 'var(--primary,#6366f1)';
                zoneExtraEl.style.fontWeight = '700';
            }
        }

        const totalEl = this.querySelector('#boostTotalPrice');
        if (totalEl) totalEl.textContent = fmt(total);
    }

    setupEventListeners() {
        // Retour
        this.querySelector('.back-from-boost')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });

        // Les options dynamiques attachent leurs propres listeners dans loadOptions()

        // ── Lancer le boost — appel API réel ──────────────────────
        const launchBtn = this.querySelector('#boostLaunchBtn');
        if (launchBtn) {
            launchBtn.addEventListener('click', async () => {
                const { api } = await import('../../api.js');

                if (!api.isAuthenticated()) {
                    launchBtn.style.background = '#ef4444';
                    launchBtn.innerHTML = '<i class="material-icons-round">error</i> Connectez-vous d\'abord';
                    setTimeout(() => {
                        launchBtn.style.background = '';
                        launchBtn.innerHTML = '<i class="material-icons-round">rocket_launch</i> Lancer le boost';
                        this.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
                    }, 1500);
                    return;
                }

                if (!this._desireId || !this._selectedPlanId) {
                    launchBtn.style.background = '#ef4444';
                    launchBtn.innerHTML = '<i class="material-icons-round">error</i> Sélectionnez une envie et un plan';
                    setTimeout(() => {
                        launchBtn.style.background = '';
                        launchBtn.innerHTML = '<i class="material-icons-round">rocket_launch</i> Lancer le boost';
                    }, 2500);
                    return;
                }

                const notifyChecked   = this.querySelector('#notifyToggle')?.checked ?? true;
                const priorityChecked = this.querySelector('#priorityToggle')?.checked ?? true;
                // Collecter les options cochées avec leur nombre de jours
                const selectedOptions = [];
                this.querySelectorAll('.boost-option-toggle:checked').forEach(t => {
                    const slug = t.dataset.optionSlug;
                    if (!slug) return;
                    const row  = t.closest('.boost-toggle-row');
                    const days = parseInt(row?.querySelector('.boost-day-value')?.dataset.days || '1');
                    selectedOptions.push({ slug, duration_days: days });
                });
                const zoneCard = this.querySelector('#boostZonesContainer .boost-radio-card.boost-selected');
                const zone = zoneCard?.querySelector('input[name="zone"]')?.value || this._selectedZone || 'commune';

                launchBtn.disabled = true;
                launchBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Activation...';

                try {
                    await api.activateBoost({
                        desire_id:         this._desireId,
                        duration_id:       this._selectedPlanId,
                        zone,
                        notify_interested: notifyChecked,
                        priority_position: priorityChecked,
                        options:           selectedOptions,
                    });

                    launchBtn.style.background = '#10b981';
                    launchBtn.innerHTML = '<i class="material-icons-round">check_circle</i> Boost activé !';
                    launchBtn.classList.add('boost-launched');

                    setTimeout(() => {
                        this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
                    }, 1500);

                } catch (err) {
                    launchBtn.disabled = false;
                    launchBtn.style.background = '#ef4444';
                    launchBtn.innerHTML = `<i class="material-icons-round">error</i> ${err.message}`;
                    setTimeout(() => {
                        launchBtn.style.background = '';
                        launchBtn.innerHTML = '<i class="material-icons-round">rocket_launch</i> Lancer le boost';
                    }, 3000);
                }
            });
        }
    }

    /**
     * @param {Object} opts
     * @param {string} [opts.desireId]    UUID de l'envie à booster
     * @param {string} [opts.desireTitle] Titre affiché dans le résumé
     */
    /**
     * @param {Object} opts
     * @param {string} [opts.desireId]    UUID de l'envie à booster
     * @param {string} [opts.desireTitle] Titre affiché dans le résumé
     */
    open({ desireId = null, desireTitle = null } = {}) {
        this._desireId = desireId;

        const titleEl = this.querySelector('#boostDesireTitle');
        if (titleEl) titleEl.textContent = desireTitle || 'Envie sélectionnée';

        this.querySelector('#boostPage').style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Charger les plans, zones et options à chaque ouverture
        this.loadPlans();
        this.loadZones();
        this.loadOptions();
    }

    hide() {
        const page = this.querySelector('#boostPage');
        if (page) page.style.display = 'none';
        document.body.style.overflow = '';

        // Reset du bouton
        const btn = this.querySelector('#boostLaunchBtn');
        if (btn) {
            btn.disabled = false;
            btn.style.background = '';
            btn.innerHTML = '<i class="material-icons-round">rocket_launch</i> Lancer le boost';
            btn.classList.remove('boost-launched');
        }
    }
}

customElements.define('app-boost-page', BoostPage);
