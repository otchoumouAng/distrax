
const DEFAULT_MAX_SPOTS = 100; // "Tout le monde"
const TOTAL_STEPS = 4;

// Raccourcis de date
const DATE_SHORTCUTS = [
    { label: "Ce soir", icon: "nights_stay", compute: () => { const d = new Date(); d.setHours(19, 0, 0, 0); return d; } },
    { label: "Demain", icon: "wb_sunny", compute: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d; } },
    { label: "Ce week-end", icon: "event", compute: () => { const d = new Date(); const day = d.getDay(); const sat = new Date(d); sat.setDate(d.getDate() + (6 - day)); sat.setHours(15, 0, 0, 0); return sat; } },
];

function toDatetimeLocalValue(date) {
    const tzOffset = date.getTimezoneOffset();
    return new Date(date.getTime() - tzOffset * 60000).toISOString().slice(0, 16);
}

export class CreationPage extends HTMLElement {
    connectedCallback() {
        this._currentStep = 0;
        this._selectedFiles = new Map();
        this._additionalFiles = [];
        this._editMode = false;
        this._editDesireId = null;
        this._existingImages = null;
        this._editToken = null;
        this._categoriesLoaded = false;
        this._communesLoaded = false;

        this.innerHTML = `
            <style>
                /* ── Container ── */
                .cr-page { display: none; flex-direction: column; height: 100svh; overflow: hidden; background: var(--bg-main); position: relative; }
                .cr-page.visible { display: flex; }

                /* ── Header compact ── */
                .cr-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: var(--glass-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-bottom: 1px solid var(--glass-border); z-index: 10; flex-shrink: 0; }
                .cr-header-left { display: flex; align-items: center; gap: 12px; }
                .cr-close-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: transparent; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
                .cr-close-btn:hover { background: rgba(0,0,0,0.05); }
                .cr-close-btn i { font-size: 26px; }
                .cr-header-title { font-size: 17px; font-weight: 700; color: var(--text-main); }
                .cr-header-badge { font-size: 12px; color: var(--text-muted); font-weight: 500; }

                /* ── Step Indicator ── */
                .cr-steps { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 14px 20px 10px; flex-shrink: 0; }
                .cr-step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border-light); transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
                .cr-step-dot.done { background: var(--primary); }
                .cr-step-dot.current { background: var(--primary); transform: scale(1.5); box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 15%, transparent); }
                .cr-step-line { width: 28px; height: 2px; border-radius: 1px; background: var(--border-light); transition: background 0.35s; }
                .cr-step-line.done { background: var(--primary); }

                /* ── Steps container ── */
                .cr-body { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
                .cr-step { display: none; flex-direction: column; padding: 0 20px 20px; min-height: 100%; animation: crFadeIn 0.35s cubic-bezier(0.16,1,0.3,1); }
                .cr-step.active { display: flex; }
                @keyframes crFadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

                /* ── STEP 1 : Photo ── */
                .cr-photo-zone { position: relative; border-radius: 20px; overflow: hidden; background: var(--bg-card); border: 2px dashed var(--border-light); min-height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.25s; margin-top: 8px; }
                .cr-photo-zone:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 3%, var(--bg-card)); }
                .cr-photo-zone.has-image { border-style: solid; border-color: transparent; min-height: 320px; }
                .cr-photo-zone.field-error { border-color: #ef4444; }
                .cr-photo-icon { font-size: 56px; color: var(--text-light); transition: all 0.25s; }
                .cr-photo-zone:hover .cr-photo-icon { color: var(--primary); transform: scale(1.05); }
                .cr-photo-label { font-size: 16px; font-weight: 600; color: var(--text-main); margin-top: 12px; }
                .cr-photo-hint { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
                .cr-photo-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%); border-radius: 20px; display: none; align-items: flex-end; padding: 20px; }
                .cr-photo-zone.has-image .cr-photo-overlay { display: flex; }
                .cr-photo-change-btn { background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
                .cr-photo-change-btn i { font-size: 16px; }
                .cr-photo-error { font-size: 12px; color: #ef4444; margin-top: 8px; display: none; }
                .cr-photo-error.visible { display: block; }

                /* ── Extra images strip ── */
                .cr-extra-strip { display: flex; gap: 10px; margin-top: 14px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
                .cr-extra-strip::-webkit-scrollbar { display: none; }
                .cr-extra-thumb { min-width: 72px; height: 72px; border-radius: 14px; background-size: cover; background-position: center; position: relative; flex-shrink: 0; border: 1px solid var(--border-light); }
                .cr-extra-remove { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: #ef4444; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; }
                .cr-extra-add { min-width: 72px; height: 72px; border-radius: 14px; border: 2px dashed var(--border-light); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-light); flex-shrink: 0; transition: all 0.2s; }
                .cr-extra-add:hover { border-color: var(--primary); color: var(--primary); }

                /* ── Fields (shared) ── */
                .cr-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
                .cr-field-label { font-weight: 600; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 4px; }
                .cr-field-label .req { color: #ef4444; font-weight: 700; }
                .cr-input, .cr-textarea { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border-light); color: var(--text-main); font-size: 15px; font-family: inherit; background: var(--bg-card); transition: all 0.2s; box-sizing: border-box; }
                .cr-input:focus, .cr-textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
                .cr-input.field-error, .cr-textarea.field-error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
                .cr-field-error { font-size: 12px; color: #ef4444; display: none; }
                .cr-field-error.visible { display: block; }
                .cr-textarea { resize: vertical; min-height: 90px; }

                /* ── Pills row ── */
                .cr-pills-row { display: flex; flex-wrap: wrap; gap: 10px; }
                .cr-pills-row filter-pill { cursor: pointer; }

                /* ── Date shortcuts ── */
                .cr-date-shortcuts { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
                .cr-date-chip { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 100px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap; }
                .cr-date-chip:hover { border-color: var(--primary); color: var(--primary); }
                .cr-date-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
                .cr-date-chip i { font-size: 16px; }

                /* ── Price ── */
                .cr-price-toggle { display: flex; gap: 10px; }
                .cr-price-opt { flex: 1; display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border-light); background: var(--bg-card); cursor: pointer; font-weight: 600; font-size: 14px; color: var(--text-main); transition: all 0.2s; font-family: inherit; }
                .cr-price-opt:hover { border-color: var(--primary); }
                .cr-price-opt.selected { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, var(--bg-card)); }
                .cr-price-opt i { font-size: 20px; }
                .cr-price-amount-wrap { display: none; position: relative; margin-top: -4px; }
                .cr-price-amount-wrap.visible { display: block; }
                .cr-price-amount-wrap .cr-input { padding-right: 52px; }
                .cr-currency { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light); font-weight: 600; font-size: 14px; pointer-events: none; }

                /* ── Footer nav ── */
                .cr-footer { display: flex; align-items: center; gap: 12px; padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--border-light); background: var(--bg-card); flex-shrink: 0; }
                .cr-btn-back { display: flex; align-items: center; gap: 6px; padding: 12px 20px; border-radius: 100px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-main); font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
                .cr-btn-back:hover { background: var(--bg-main); }
                .cr-btn-back:disabled { opacity: 0.4; cursor: not-allowed; }
                .cr-btn-next { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; border-radius: 100px; border: none; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; box-shadow: 0 6px 20px color-mix(in srgb, var(--primary) 35%, transparent); }
                .cr-btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 45%, transparent); }
                .cr-btn-next:active { transform: scale(0.98); }
                .cr-btn-next:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
                .cr-btn-publish { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; border-radius: 100px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; box-shadow: 0 6px 20px rgba(16,185,129,0.35); }
                .cr-btn-publish:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(16,185,129,0.45); }
                .cr-btn-publish:active { transform: scale(0.98); }
                .cr-btn-publish:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

                /* ── Preview card — uses the real .desire-card classes from components.css ── */
                .cr-preview-wrap { margin-top: 12px; }
                .cr-preview-wrap .desire-card { pointer-events: none; }
                /* Avatar icon fallback (no img, pure material icon) */
                .cr-avatar-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--border-light); display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; }
                .cr-avatar-icon i { font-size: 24px; }
                /* The preview card reuses existing .desire-card, .card-image, .card-header,
                   .user-info, .user-avatar, .user-details, .theme-icon, .card-body,
                   .card-meta, .meta-tag, .card-footer, .participants, .avatars-stack,
                   .spots-left, .card-actions, .ca-btn--view from components.css */

                /* ── Step title ── */
                .cr-step-title { font-size: 20px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
                .cr-step-sub { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }

                /* ── Loading overlay ── */
                .cr-loading-overlay { position: absolute; inset: 0; background: var(--bg-main); display: flex; align-items: center; justify-content: center; z-index: 20; }
                .cr-loading-overlay .cr-loading-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--text-light); }
                .cr-loading-overlay i { font-size: 40px; animation: spin 1s linear infinite; color: var(--primary); }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── Responsive ── */
                @media (max-width: 600px) {
                    .cr-header { padding: 12px 16px; }
                    .cr-header-title { font-size: 16px; }
                    .cr-step { padding: 0 16px 16px; }
                    .cr-footer { padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); }
                    .cr-photo-zone { min-height: 280px; }
                    .cr-photo-zone.has-image { min-height: 260px; }
                    .cr-step-title { font-size: 18px; }
                }
            </style>
            <div class="cr-page" id="crPage">
                <!-- Header -->
                <header class="cr-header">
                    <div class="cr-header-left">
                        <button class="cr-close-btn cr-back-btn" title="Annuler" aria-label="Annuler"><i class="material-icons-round">close</i></button>
                        <span class="cr-header-title" id="crHeaderTitle">Proposer une envie</span>
                    </div>
                    <span class="cr-header-badge" id="crHeaderBadge">1/4</span>
                </header>

                <!-- Steps indicator -->
                <div class="cr-steps" id="crSteps">
                    <span class="cr-step-dot current" data-step="0"></span>
                    <span class="cr-step-line"></span>
                    <span class="cr-step-dot" data-step="1"></span>
                    <span class="cr-step-line"></span>
                    <span class="cr-step-dot" data-step="2"></span>
                    <span class="cr-step-line"></span>
                    <span class="cr-step-dot" data-step="3"></span>
                </div>

                <!-- Body with steps -->
                <div class="cr-body" id="crBody">
                    <!-- STEP 1: Photo -->
                    <div class="cr-step active" data-step="0">
                        <p class="cr-step-title">Une image pour ton envie</p>
                        <p class="cr-step-sub">Choisis une photo qui donne envie !</p>
                        <div class="cr-photo-zone" id="crPhotoZone">
                            <i class="material-icons-round cr-photo-icon">add_photo_alternate</i>
                            <span class="cr-photo-label">Ajouter une photo de couverture</span>
                            <span class="cr-photo-hint">Format paysage idéal — JPG, PNG, WebP</span>
                            <div class="cr-photo-overlay">
                                <button class="cr-photo-change-btn" type="button"><i class="material-icons-round">swap_horiz</i> Changer</button>
                            </div>
                        </div>
                        <span class="cr-photo-error" id="crPhotoError">Une image de couverture est requise.</span>
                        <input type="file" accept="image/jpeg, image/png, image/webp" id="crMainImageInput" style="display:none;">

                        <!-- Extra images -->
                        <div class="cr-extra-strip" id="crExtraStrip">
                            <div class="cr-extra-add" id="crExtraAdd"><i class="material-icons-round" style="font-size:28px;">add</i></div>
                        </div>
                        <input type="file" accept="image/jpeg, image/png, image/webp" multiple id="crExtraImageInput" style="display:none;">
                    </div>

                    <!-- STEP 2: Essentials -->
                    <div class="cr-step" data-step="1">
                        <p class="cr-step-title">Les infos essentielles</p>
                        <p class="cr-step-sub">Donne un titre, une catégorie et une date.</p>
                        <div class="cr-field">
                            <label class="cr-field-label"><span class="req">*</span> Titre de ton envie</label>
                            <input id="crTitleInput" type="text" class="cr-input" placeholder="Ex: Jouer au tennis à 4..." maxlength="120">
                            <span class="cr-field-error" id="crTitleError">Le titre est requis.</span>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label"><span class="req">*</span> Catégorie</label>
                            <div class="cr-pills-row" id="crCategorySelector">
                                <span id="crCategoriesLoading" style="color:var(--text-light);font-size:14px;padding:8px;">Chargement...</span>
                            </div>
                            <span class="cr-field-error" id="crCategoryError">Sélectionne une catégorie.</span>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label"><span class="req">*</span> Date et heure</label>
                            <div class="cr-date-shortcuts" id="crDateShortcuts"></div>
                            <input id="crDateInput" type="datetime-local" class="cr-input">
                            <span class="cr-field-error" id="crDateError">La date est requise.</span>
                        </div>
                    </div>

                    <!-- STEP 3: Details -->
                    <div class="cr-step" data-step="2">
                        <p class="cr-step-title">Les détails</p>
                        <p class="cr-step-sub">Où, combien, et ce qu'il faut savoir.</p>
                        <div class="cr-field">
                            <label class="cr-field-label"><span class="req">*</span> Commune</label>
                            <div class="cr-pills-row" id="crCommuneSelector" style="max-height: 200px; overflow-y: auto;">
                                <span id="crCommunesLoading" style="color:var(--text-light);font-size:14px;padding:8px;">Chargement...</span>
                            </div>
                            <span class="cr-field-error" id="crCommuneError">Choisis une commune.</span>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label"><span class="req">*</span> Adresse / Lieu exact</label>
                            <input id="crAddressInput" type="text" class="cr-input" placeholder="Ex: Parc sportif, rue 12..." maxlength="200">
                            <span class="cr-field-error" id="crAddressError">L'adresse est requise.</span>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label">Prix</label>
                            <div class="cr-price-toggle">
                                <button type="button" class="cr-price-opt selected" data-price="free" id="crPriceFree">
                                    <i class="material-icons-round">check_circle</i> Gratuit
                                </button>
                                <button type="button" class="cr-price-opt" data-price="paid" id="crPricePaid">
                                    <i class="material-icons-round">check_circle</i> Payant
                                </button>
                            </div>
                            <div class="cr-price-amount-wrap" id="crPriceAmountWrap">
                                <input id="crAmountInput" type="number" class="cr-input" placeholder="Montant" min="0" step="500">
                                <span class="cr-currency">FCFA</span>
                            </div>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label">Nombre de personnes</label>
                            <div class="cr-price-toggle">
                                <button type="button" class="cr-price-opt selected" data-spots="unlimited" id="crSpotsUnlimited">
                                    <i class="material-icons-round">public</i> Tout le monde
                                </button>
                                <button type="button" class="cr-price-opt" data-spots="limited" id="crSpotsLimited">
                                    <i class="material-icons-round">group</i> Nombre limité
                                </button>
                            </div>
                            <div class="cr-price-amount-wrap" id="crSpotsInputWrap">
                                <input id="crMaxSpotsInput" type="number" class="cr-input" placeholder="Nombre max" min="1" max="100" step="1">
                                <span class="cr-currency">pers.</span>
                            </div>
                        </div>
                        <div class="cr-field">
                            <label class="cr-field-label">Détails supplémentaires</label>
                            <textarea id="crDescTextarea" class="cr-textarea" placeholder="Précise ton envie, le niveau requis, matériel à apporter..." rows="3"></textarea>
                        </div>
                    </div>

                    <!-- STEP 4: Preview & Publish -->
                    <div class="cr-step" data-step="3">
                        <p class="cr-step-title">Aperçu de ton envie</p>
                        <p class="cr-step-sub">Voilà ce que les autres verront.</p>
                        <div class="cr-preview-wrap" id="crPreviewWrap"></div>
                    </div>
                </div>

                <!-- Footer navigation -->
                <div class="cr-footer" id="crFooter">
                    <button class="cr-btn-back" id="crBtnBack" disabled><i class="material-icons-round">arrow_back</i> Retour</button>
                    <button class="cr-btn-next" id="crBtnNext">Suivant <i class="material-icons-round">arrow_forward</i></button>
                    <button class="cr-btn-publish" id="crBtnPublish" style="display:none;"><i class="material-icons-round">publish</i> Publier l'envie</button>
                </div>
            </div>
        `;

        this._setupElements();
        this._setupListeners();
        this._renderDateShortcuts();
    }

    /* ── Éléments DOM ── */
    _setupElements() {
        const q = (sel) => this.querySelector(sel);
        this._page = q('#crPage');
        this._headerTitle = q('#crHeaderTitle');
        this._headerBadge = q('#crHeaderBadge');
        this._stepsContainer = q('#crSteps');
        this._body = q('#crBody');
        this._footer = q('#crFooter');
        this._btnBack = q('#crBtnBack');
        this._btnNext = q('#crBtnNext');
        this._btnPublish = q('#crBtnPublish');
        this._photoZone = q('#crPhotoZone');
        this._mainImageInput = q('#crMainImageInput');
        this._extraStrip = q('#crExtraStrip');
        this._extraAdd = q('#crExtraAdd');
        this._extraImageInput = q('#crExtraImageInput');
        this._photoError = q('#crPhotoError');
        this._titleInput = q('#crTitleInput');
        this._categorySelector = q('#crCategorySelector');
        this._categoriesLoading = q('#crCategoriesLoading');
        this._dateInput = q('#crDateInput');
        this._dateShortcuts = q('#crDateShortcuts');
        this._communeSelector = q('#crCommuneSelector');
        this._communesLoading = q('#crCommunesLoading');
        this._addressInput = q('#crAddressInput');
        this._descTextarea = q('#crDescTextarea');
        this._amountInput = q('#crAmountInput');
        this._maxSpotsInput = q('#crMaxSpotsInput');
        this._spotsUnlimited = q('#crSpotsUnlimited');
        this._spotsLimited = q('#crSpotsLimited');
        this._spotsInputWrap = q('#crSpotsInputWrap');
        this._priceAmountWrap = q('#crPriceAmountWrap');
        this._priceFree = q('#crPriceFree');
        this._pricePaid = q('#crPricePaid');
    }

    /* ── Event listeners ── */
    _setupListeners() {
        // Close / back
        const closeBtn = this.querySelector('.cr-close-btn');
        closeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (this.hasUnsavedContent()) {
                const { showConfirm } = await import('../../utils/confirm.js');
                const ok = await showConfirm({
                    title: 'Quitter la création ?',
                    message: 'Tu as des modifications non enregistrées. Es-tu sûr de vouloir quitter ?',
                    confirmLabel: 'Quitter',
                    cancelLabel: 'Rester',
                    type: 'warning'
                });
                if (!ok) return;
            }
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        });

        // Load data
        this._loadCategories();
        this._loadCommunes();

        // Navigation buttons
        this._btnBack.addEventListener('click', () => this._goToStep(this._currentStep - 1));
        this._btnNext.addEventListener('click', () => this._goToStep(this._currentStep + 1));
        this._btnPublish.addEventListener('click', () => this._handleSubmit());

        // Photo zone
        this._photoZone.addEventListener('click', (e) => {
            if (e.target.closest('.cr-photo-change-btn')) return;
            this._mainImageInput.click();
        });
        this._mainImageInput.addEventListener('change', (e) => this._handleMainImage(e));

        // Extra images
        this._extraAdd.addEventListener('click', () => this._extraImageInput.click());
        this._extraImageInput.addEventListener('change', (e) => this._handleExtraImages(e));

        // Price toggle
        this._priceFree.addEventListener('click', () => this._setPriceType('free'));
        this._pricePaid.addEventListener('click', () => this._setPriceType('paid'));

        // Spots toggle
        this._spotsUnlimited.addEventListener('click', () => this._setSpotsType('unlimited'));
        this._spotsLimited.addEventListener('click', () => this._setSpotsType('limited'));

        // Categories exclusive
        this._categorySelector.addEventListener('click', (e) => {
            const pill = e.target.closest('filter-pill');
            if (!pill) return;
            this._categorySelector.querySelectorAll('filter-pill').forEach(p => {
                if (p !== pill) { p.removeAttribute('active'); p.classList.remove('active'); }
            });
        });
    }

    /* ── Step navigation ── */
    _goToStep(step) {
        if (step < 0 || step >= TOTAL_STEPS) return;
        // Validate current step before moving forward
        if (step > this._currentStep && !this._validateStep(this._currentStep)) return;

        this._currentStep = step;
        this._renderSteps();
    }

    _renderSteps() {
        const dots = this._stepsContainer.querySelectorAll('.cr-step-dot');
        const lines = this._stepsContainer.querySelectorAll('.cr-step-line');
        dots.forEach((dot, i) => {
            dot.classList.remove('done', 'current');
            if (i < this._currentStep) dot.classList.add('done');
            if (i === this._currentStep) dot.classList.add('current');
        });
        lines.forEach((line, i) => {
            line.classList.toggle('done', i < this._currentStep);
        });

        // Show/hide steps
        this._body.querySelectorAll('.cr-step').forEach((s, i) => {
            s.classList.toggle('active', i === this._currentStep);
        });

        // Scroll body to top
        this._body.scrollTop = 0;

        // Header badge
        this._headerBadge.textContent = `${this._currentStep + 1}/${TOTAL_STEPS}`;

        // Buttons
        this._btnBack.disabled = this._currentStep === 0;
        if (this._currentStep === TOTAL_STEPS - 1) {
            this._btnNext.style.display = 'none';
            this._btnPublish.style.display = 'flex';
        } else {
            this._btnNext.style.display = 'flex';
            this._btnPublish.style.display = 'none';
        }

        // Update preview when reaching step 4
        if (this._currentStep === 3) {
            this._refreshPreview();
        }
    }

    /* ── Validation ── */
    _validateStep(step) {
        switch (step) {
            case 0: return this._validatePhoto();
            case 1: return this._validateEssentials();
            case 2: return this._validateDetails();
            default: return true;
        }
    }

    _validatePhoto() {
        const hasExisting = this._editMode && this._existingImages && this._existingImages.length > 0;
        const hasNew = this._selectedFiles.size > 0;
        if (!hasExisting && !hasNew) {
            this._photoZone.classList.add('field-error');
            this._photoError.classList.add('visible');
            return false;
        }
        this._photoZone.classList.remove('field-error');
        this._photoError.classList.remove('visible');
        return true;
    }

    _validateEssentials() {
        let valid = true;
        const showErr = (input, errEl) => { input?.classList.add('field-error'); errEl?.classList.add('visible'); };
        const clearErr = (input, errEl) => { input?.classList.remove('field-error'); errEl?.classList.remove('visible'); };

        const titleErr = this.querySelector('#crTitleError');
        clearErr(this._titleInput, titleErr);
        if (!this._titleInput.value.trim()) { showErr(this._titleInput, titleErr); valid = false; }

        const catErr = this.querySelector('#crCategoryError');
        const activeCat = this._categorySelector.querySelector('filter-pill[active], filter-pill.active');
        catErr?.classList.remove('visible');
        if (!activeCat) { catErr?.classList.add('visible'); valid = false; }

        const dateErr = this.querySelector('#crDateError');
        clearErr(this._dateInput, dateErr);
        if (!this._dateInput.value) { showErr(this._dateInput, dateErr); valid = false; }

        if (!valid) {
            const firstErr = this._body.querySelector('.cr-step.active .field-error');
            firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return valid;
    }

    _validateDetails() {
        let valid = true;
        const showErr = (input, errEl) => { input?.classList.add('field-error'); errEl?.classList.add('visible'); };
        const clearErr = (input, errEl) => { input?.classList.remove('field-error'); errEl?.classList.remove('visible'); };

        const communeErr = this.querySelector('#crCommuneError');
        const activeCommune = this._communeSelector.querySelector('filter-pill[active], filter-pill.active');
        communeErr?.classList.remove('visible');
        if (!activeCommune) { communeErr?.classList.add('visible'); valid = false; }

        const addrErr = this.querySelector('#crAddressError');
        clearErr(this._addressInput, addrErr);
        if (!this._addressInput.value.trim()) { showErr(this._addressInput, addrErr); valid = false; }

        if (!valid) {
            const firstErr = this._body.querySelector('.cr-step.active .field-error');
            firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return valid;
    }

    /* ── Image handling ── */
    _handleMainImage(e) {
        const file = e.target.files[0];
        if (!file) return;

        this._selectedFiles.set(this._mainImageInput, file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            this._photoZone.style.backgroundImage = `url('${ev.target.result}')`;
            this._photoZone.style.backgroundSize = 'cover';
            this._photoZone.style.backgroundPosition = 'center';
            this._photoZone.classList.add('has-image');
            this._photoZone.classList.remove('field-error');
            this._photoError.classList.remove('visible');
            // Hide placeholder content
            this._photoZone.querySelectorAll(':scope > i, :scope > span').forEach(el => el.style.display = 'none');
        };
        reader.readAsDataURL(file);
    }

    _handleExtraImages(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        this._additionalFiles = [...this._additionalFiles, ...files];
        this._renderExtraThumbnails();
        this._extraImageInput.value = '';
    }

    _renderExtraThumbnails() {
        // Clear existing thumbnails (keep the add button)
        this._extraStrip.querySelectorAll('.cr-extra-thumb').forEach(t => t.remove());

        this._additionalFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const thumb = document.createElement('div');
                thumb.className = 'cr-extra-thumb';
                thumb.style.backgroundImage = `url('${ev.target.result}')`;
                const removeBtn = document.createElement('button');
                removeBtn.className = 'cr-extra-remove';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = (evt) => {
                    evt.stopPropagation();
                    this._additionalFiles.splice(index, 1);
                    this._renderExtraThumbnails();
                };
                thumb.appendChild(removeBtn);
                // Insert before the add button
                this._extraStrip.insertBefore(thumb, this._extraAdd);
            };
            reader.readAsDataURL(file);
        });
    }

    /* ── Price ── */
    _setPriceType(type) {
        this._priceFree.classList.toggle('selected', type === 'free');
        this._pricePaid.classList.toggle('selected', type === 'paid');
        this._priceAmountWrap.classList.toggle('visible', type === 'paid');
        if (type === 'free') this._amountInput.value = '';
    }

    _setSpotsType(type) {
        this._spotsUnlimited.classList.toggle('selected', type === 'unlimited');
        this._spotsLimited.classList.toggle('selected', type === 'limited');
        this._spotsInputWrap.classList.toggle('visible', type === 'limited');
        if (type === 'unlimited') this._maxSpotsInput.value = '';
    }

    /* ── Date shortcuts ── */
    _renderDateShortcuts() {
        this._dateShortcuts.innerHTML = '';
        DATE_SHORTCUTS.forEach((sc, i) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cr-date-chip';
            chip.innerHTML = `<i class="material-icons-round">${sc.icon}</i>${sc.label}`;
            chip.addEventListener('click', () => {
                const date = sc.compute();
                this._dateInput.value = toDatetimeLocalValue(date);
                // Highlight active
                this._dateShortcuts.querySelectorAll('.cr-date-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
            this._dateShortcuts.appendChild(chip);

            // Also listen to manual date changes to clear chip selection
            this._dateInput.addEventListener('input', () => {
                this._dateShortcuts.querySelectorAll('.cr-date-chip').forEach(c => c.classList.remove('active'));
            });
        });
    }

    /* ── Preview ── */
    _refreshPreview() {
        const title = this._titleInput.value.trim() || 'Titre de l\'envie';
        const activeCat = this._categorySelector.querySelector('filter-pill[active], filter-pill.active');
        const catIcon = activeCat?.getAttribute('icon') || 'label';
        const catSlug = activeCat?.dataset?.slug || 'explore';
        const themeSafe = ['explore', 'sport', 'chill', 'learn', 'rencontres'].includes(catSlug) ? catSlug : 'explore';
        const dateVal = this._dateInput.value;
        const commune = this._communeSelector.querySelector('filter-pill[active], filter-pill.active')?.getAttribute('text') || 'Abidjan';
        const priceType = this._pricePaid.classList.contains('selected') ? 'paid' : 'free';
        const amount = this._amountInput.value;

        // Format date & price
        let dateFormatted = 'Maintenant';
        let dateIcon = 'flash_on';
        if (dateVal) {
            const d = new Date(dateVal);
            dateFormatted = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            dateIcon = 'calendar_today';
        }
        let priceFormatted = 'Gratuit';
        let priceIcon = 'payments';
        if (priceType === 'paid' && amount) {
            priceFormatted = `${parseInt(amount).toLocaleString('fr-FR')} FCFA`;
            priceIcon = 'payments';
        }

        // Image
        const hasExisting = this._editMode && this._existingImages && this._existingImages.length > 0;
        let firstImageUrl = '';
        if (this._selectedFiles.size > 0) {
            const [input, file] = [...this._selectedFiles.entries()][0];
            firstImageUrl = URL.createObjectURL(file);
        } else if (hasExisting) {
            firstImageUrl = this._existingImages[0];
        }
        const imageHtml = firstImageUrl
            ? `<div class="card-image"><img src="${firstImageUrl}" alt="" class="card-image-img"></div>`
            : '';

        // Avatar — Material icon instead of image
        const avatarHtml = '<span class="cr-avatar-icon"><i class="material-icons-round">person</i></span>';

        // Spots
        const maxSpots = this._spotsLimited.classList.contains('selected')
            ? (parseInt(this._maxSpotsInput.value) || DEFAULT_MAX_SPOTS)
            : DEFAULT_MAX_SPOTS;
        const spotsHtml = `<span class="spots-left">0 / ${maxSpots} places</span>`;

        // Build the real desire-card HTML
        const wrap = this.querySelector('#crPreviewWrap');
        wrap.innerHTML = `
            <article class="desire-card card-${themeSafe}">
                ${imageHtml}
                <div class="card-header">
                    <div class="user-info">
                        ${avatarHtml}
                        <div class="user-details">
                            <h3>Moi</h3><span>À l'instant</span>
                        </div>
                    </div>
                    <div class="theme-icon"><i class="material-icons-round">${catIcon}</i></div>
                </div>
                <div class="card-body">
                    <h2>${title}</h2>
                    <div class="card-meta">
                        <span class="meta-tag"><i class="material-icons-round">location_on</i> ${commune}</span>
                        <span class="meta-tag"><i class="material-icons-round">${dateIcon}</i> ${dateFormatted}</span>
                        <span class="meta-tag"><i class="material-icons-round">${priceIcon}</i> ${priceFormatted}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="participants">
                        <div class="avatars-stack">
                            ${avatarHtml}
                        </div>
                        ${spotsHtml}
                    </div>
                </div>
            </article>
        `;
    }

    /* ── Submit ── */
    async _handleSubmit() {
        const btn = this._btnPublish;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="material-icons-round" style="animation:spin 1s linear infinite;">autorenew</i> Envoi des images...';

        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) throw new Error('Connectez-vous pour publier une envie');

            // Upload main images
            const mainImageUrls = [];
            for (const [input, file] of this._selectedFiles.entries()) {
                const url = await api.uploadToS3(file);
                mainImageUrls.push(url);
            }

            // Upload extra images
            const additionalImageUrls = [];
            for (const file of this._additionalFiles) {
                const url = await api.uploadToS3(file);
                additionalImageUrls.push(url);
            }
            const uploadedImageUrls = [...mainImageUrls, ...additionalImageUrls];

            btn.innerHTML = '<i class="material-icons-round" style="animation:spin 1s linear infinite;">autorenew</i> Publication...';

            // Payload
            const activeCat = this._categorySelector.querySelector('filter-pill[active], filter-pill.active');
            const activeCommune = this._communeSelector.querySelector('filter-pill[active], filter-pill.active');
            const priceType = this._pricePaid.classList.contains('selected') ? 'paid' : 'free';

            const payload = {
                title: this._titleInput.value.trim(),
                category: activeCat?.dataset?.slug || null,
                commune: activeCommune?.getAttribute('text') || '',
                address: this._addressInput.value.trim(),
                event_date: new Date(this._dateInput.value).toISOString(),
                price_type: priceType,
                price_amount: this._amountInput.value ? parseInt(this._amountInput.value) : null,
                description: this._descTextarea.value.trim() || null,
                images: uploadedImageUrls,
                max_spots: this._spotsLimited.classList.contains('selected')
                    ? (parseInt(this._maxSpotsInput.value) || DEFAULT_MAX_SPOTS)
                    : DEFAULT_MAX_SPOTS,
            };

            if (this._editMode && this._editDesireId) {
                btn.innerHTML = '<i class="material-icons-round" style="animation:spin 1s linear infinite;">autorenew</i> Mise à jour...';
                const existing = this._existingImages || [];
                const finalMain = mainImageUrls.length > 0 ? mainImageUrls : existing.slice(0, 1);
                const finalAdditional = additionalImageUrls.length > 0 ? additionalImageUrls : existing.slice(1);
                const finalImages = [...finalMain, ...finalAdditional];
                if (finalImages.length > 0) payload.images = finalImages;
                else delete payload.images;
                await api.updateDesire(this._editDesireId, payload);
                btn.style.background = '#10b981';
                btn.innerHTML = '<i class="material-icons-round">check</i> Mis à jour !';
                setTimeout(() => this._resetAndNavigate(null, true), 1200);
            } else {
                const created = await api.createDesire(payload);
                btn.style.background = '#10b981';
                btn.innerHTML = '<i class="material-icons-round">check</i> Publié !';
                const newId = created?.id ?? created?.data?.id;
                setTimeout(() => this._resetAndNavigate(newId, false), 1200);
            }
        } catch (err) {
            btn.disabled = false;
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.innerHTML = originalHtml;
            const msg = (err && err.message) ? String(err.message) : '';
            let friendly = msg;
            if (msg.includes('upload') || msg.includes('S3') || msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch'))
                friendly = 'Échec de l\'upload des images. Vérifie ta connexion.';
            else if (msg.includes('401') || msg.includes('Connectez') || msg.includes('authentif'))
                friendly = 'Session expirée. Reconnecte-toi.';
            else if (msg.length > 55) friendly = 'Une erreur est survenue. Réessaie.';
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: friendly, type: 'error' }, bubbles: true, composed: true }));
        }
    }

    _resetAndNavigate(newId, isEdit) {
        const btn = this._btnPublish;
        btn.disabled = false;
        btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        btn.innerHTML = '<i class="material-icons-round">publish</i> Publier l\'envie';

        // Reset all state
        this._currentStep = 0;
        this._selectedFiles.clear();
        this._additionalFiles = [];
        this._editMode = false;
        this._editDesireId = null;
        this._existingImages = null;

        // Reset form
        this._titleInput.value = '';
        this._dateInput.value = '';
        this._addressInput.value = '';
        this._descTextarea.value = '';
        this._amountInput.value = '';
        this._setPriceType('free');
        this._setSpotsType('unlimited');

        // Reset photo (resetAndNavigate)
        this._photoZone.style.backgroundImage = 'none';
        this._photoZone.classList.remove('has-image', 'field-error');
        this._photoError.classList.remove('visible');
        this._photoZone.querySelectorAll(':scope > i, :scope > span').forEach(el => el.style.display = '');

        // Reset extra
        this._extraStrip.querySelectorAll('.cr-extra-thumb').forEach(t => t.remove());

        // Reset categories
        this._categorySelector.querySelectorAll('filter-pill').forEach(p => { p.removeAttribute('active'); p.classList.remove('active'); });

        // Reset communes
        this._communeSelector.querySelectorAll('filter-pill').forEach(p => { p.removeAttribute('active'); p.classList.remove('active'); });

        // Reset date shortcuts
        this._dateShortcuts.querySelectorAll('.cr-date-chip').forEach(c => c.classList.remove('active'));

        // Reset field errors
        this.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
        this.querySelectorAll('.cr-field-error.visible').forEach(el => el.classList.remove('visible'));

        // Reset UI
        this._renderSteps();

        // Navigate
        if (isEdit) {
            this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
        } else {
            window.dispatchEvent(new CustomEvent('refresh-explorer', { bubbles: true, composed: true }));
            window.dispatchEvent(new CustomEvent('navigate-profile', { bubbles: true, composed: true }));
            if (newId) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('view-desire', { detail: { id: newId }, bubbles: true, composed: true }));
                }, 150);
            }
        }
    }

    /* ── Categories ── */
    async _loadCategories() {
        const selector = this._categorySelector;
        if (!selector) return;
        try {
            const { api } = await import('../../api.js');
            const raw = await api.getCategoriesFull();
            const items = Array.isArray(raw) ? raw.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)) : [];
            const loading = this._categoriesLoading;
            if (loading) loading.remove();
            this._categoriesLoaded = true;
            if (items.length > 0) {
                items.forEach((cat, idx) => {
                    const pill = document.createElement('filter-pill');
                    pill.setAttribute('icon', cat.icon || 'label');
                    pill.setAttribute('interactive', '');
                    pill.setAttribute('text', cat.label || cat.slug || '');
                    pill.dataset.slug = cat.slug;
                    selector.appendChild(pill);
                });
            }
        } catch (e) {
            console.warn('[CreationPage] Catégories non chargées:', e.message);
        }
    }

    /* ── Communes as pills ── */
    async _loadCommunes() {
        const selector = this._communeSelector;
        if (!selector) return;
        try {
            const { api } = await import('../../api.js');
            const items = await api.getCommunesFull();
            const loading = this._communesLoading;
            if (loading) loading.remove();
            this._communesLoaded = true;

            let communes = [];
            if (Array.isArray(items) && items.length > 0) {
                communes = items.map(c => typeof c === 'string' ? c : (c.label || c.slug || ''));
            } else {
                communes = ['Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon', 'Bingerville', 'Songon', 'Anyama'];
            }

            communes.forEach(c => {
                const pill = document.createElement('filter-pill');
                pill.setAttribute('icon', 'location_on');
                pill.setAttribute('interactive', '');
                pill.setAttribute('text', c);
                pill.dataset.value = c;
                selector.appendChild(pill);
            });

            // Exclusive selection
            selector.addEventListener('click', (e) => {
                const pill = e.target.closest('filter-pill');
                if (!pill) return;
                selector.querySelectorAll('filter-pill').forEach(p => {
                    if (p !== pill) { p.removeAttribute('active'); p.classList.remove('active'); }
                });
                this.querySelector('#crCommuneError')?.classList.remove('visible');
            });
        } catch (e) {
            console.warn('[CreationPage] Communes non chargées:', e.message);
            const fallback = ['Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon', 'Bingerville', 'Songon', 'Anyama'];
            const loading = this._communesLoading;
            if (loading) loading.remove();
            this._communesLoaded = true;
            fallback.forEach(c => {
                const pill = document.createElement('filter-pill');
                pill.setAttribute('icon', 'location_on');
                pill.setAttribute('interactive', '');
                pill.setAttribute('text', c);
                pill.dataset.value = c;
                selector.appendChild(pill);
            });
        }
    }

    /* ── Unsaved content ── */
    hasUnsavedContent() {
        const title = this._titleInput?.value?.trim() || '';
        const date = this._dateInput?.value || '';
        const address = this._addressInput?.value?.trim() || '';
        const desc = this._descTextarea?.value?.trim() || '';
        const activeCommune = this._communeSelector?.querySelector('filter-pill[active], filter-pill.active');
        const activeCat = this._categorySelector?.querySelector('filter-pill[active], filter-pill.active');
        const hasMainImage = this._selectedFiles.size > 0 || (this._photoZone?.classList.contains('has-image'));
        const hasExtra = this._additionalFiles.length > 0;
        return !!(title || date || address || desc || activeCommune || activeCat || hasMainImage || hasExtra);
    }

    /* ── Edit mode ── */
    async edit(data) {
        const desireId = data.desireId;
        if (!desireId) return;

        this._editMode = true;
        this._editDesireId = desireId;
        this._editToken = Symbol();

        // Show loading overlay
        const overlay = document.createElement('div');
        overlay.className = 'cr-loading-overlay';
        overlay.innerHTML = `
            <div class="cr-loading-inner">
                <i class="material-icons-round">autorenew</i>
                <span style="font-size:14px;font-weight:500;">Chargement de l'annonce...</span>
            </div>`;
        this._page.style.position = 'relative';
        this._page.appendChild(overlay);

        try {
            const { api } = await import('../../api.js');
            const desire = await api.getDesire(desireId);
            overlay.remove();

            // Fill form
            if (this._titleInput) this._titleInput.value = desire.title || '';

            // Category
            if (desire.category) {
                const pills = this._categorySelector.querySelectorAll('filter-pill');
                pills.forEach(p => { p.classList.remove('active'); p.removeAttribute('active'); });
                const target = Array.from(pills).find(p => p.dataset.slug === desire.category);
                if (target) target.setAttribute('active', 'true');
            }

            // Date
            if (this._dateInput && desire.event_date) {
                const d = new Date(desire.event_date);
                this._dateInput.value = toDatetimeLocalValue(d);
            }

            // Commune
            if (desire.commune) {
                const pills = this._communeSelector.querySelectorAll('filter-pill');
                pills.forEach(p => { p.classList.remove('active'); p.removeAttribute('active'); });
                const target = Array.from(pills).find(p => p.getAttribute('text') === desire.commune || p.dataset.value === desire.commune);
                if (target) target.setAttribute('active', 'true');
            }

            // Address
            if (this._addressInput && desire.address) this._addressInput.value = desire.address;

            // Description
            if (this._descTextarea && desire.description) this._descTextarea.value = desire.description;

            // Price
            if (desire.price_type === 'paid') {
                this._setPriceType('paid');
                if (this._amountInput && desire.price_amount) this._amountInput.value = desire.price_amount;
            }

            // Max spots
            if (desire.max_spots != null && desire.max_spots < DEFAULT_MAX_SPOTS) {
                this._setSpotsType('limited');
                if (this._maxSpotsInput) this._maxSpotsInput.value = desire.max_spots;
            }

            // Images
            this._existingImages = desire.images || [];
            if (this._existingImages.length > 0) {
                this._photoZone.style.backgroundImage = `url('${this._existingImages[0]}')`;
                this._photoZone.style.backgroundSize = 'cover';
                this._photoZone.style.backgroundPosition = 'center';
                this._photoZone.classList.add('has-image');
                this._photoZone.querySelectorAll(':scope > i, :scope > span').forEach(el => el.style.display = 'none');

                // Extra existing images
                if (this._existingImages.length > 1) {
                    this._existingImages.slice(1).forEach(url => {
                        const thumb = document.createElement('div');
                        thumb.className = 'cr-extra-thumb';
                        thumb.style.backgroundImage = `url('${url}')`;
                        this._extraStrip.insertBefore(thumb, this._extraAdd);
                    });
                }
            }

            // Update header & button
            this._headerTitle.textContent = 'Modifier l\'envie';
            this._btnPublish.innerHTML = '<i class="material-icons-round">save</i> Mettre à jour';
        } catch (err) {
            overlay.remove();
            console.error('Erreur chargement édition', err);
            alert("Impossible de charger l'annonce pour édition");
        }
    }

    /* ── Show / Hide ── */
    show() {
        this._page.style.display = 'flex';
        if (this._pendingEdit) {
            const data = this._pendingEdit;
            this._pendingEdit = null;
            this.edit(data);
        }
    }

    hide() {
        this._page.style.display = 'none';
        this._editToken = null;
        this._editMode = false;
        this._editDesireId = null;
        this._existingImages = null;
        this._currentStep = 0;

        // Remove loading overlay if any
        const overlay = this._page.querySelector('.cr-loading-overlay');
        if (overlay) overlay.remove();

        // Reset header
        this._headerTitle.textContent = 'Proposer une envie';
        this._btnPublish.innerHTML = '<i class="material-icons-round">publish</i> Publier l\'envie';

        // Reset form
        if (this._titleInput) this._titleInput.value = '';
        if (this._dateInput) this._dateInput.value = '';
        if (this._addressInput) this._addressInput.value = '';
        if (this._descTextarea) this._descTextarea.value = '';
        if (this._amountInput) this._amountInput.value = '';
        this._setPriceType('free');
        if (this._spotsUnlimited && this._spotsLimited) this._setSpotsType('unlimited');

        // Reset photo
        this._photoZone.style.backgroundImage = 'none';
        this._photoZone.classList.remove('has-image', 'field-error');
        this._photoError.classList.remove('visible');
        this._photoZone.querySelectorAll(':scope > i, :scope > span').forEach(el => el.style.display = '');

        // Reset extra
        this._extraStrip.querySelectorAll('.cr-extra-thumb').forEach(t => t.remove());

        // Reset selection
        this._selectedFiles.clear();
        this._additionalFiles = [];

        // Reset pills
        this._categorySelector.querySelectorAll('filter-pill').forEach(p => { p.removeAttribute('active'); p.classList.remove('active'); });
        this._communeSelector.querySelectorAll('filter-pill').forEach(p => { p.removeAttribute('active'); p.classList.remove('active'); });

        // Reset date shortcuts
        this._dateShortcuts.querySelectorAll('.cr-date-chip').forEach(c => c.classList.remove('active'));

        // Reset field errors
        this.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
        this.querySelectorAll('.cr-field-error.visible').forEach(el => el.classList.remove('visible'));

        // Reset navigation
        this._renderSteps();
    }
}

customElements.define('app-creation-page', CreationPage);
