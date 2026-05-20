export class CreationPage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <style>
                .creation-form { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
                .form-group { display: flex; flex-direction: column; gap: 8px; }
                .form-label { font-weight: 600; color: var(--text-main); font-size: 15px; }
                .form-input, .form-select, .form-textarea { width: 100%; padding: 16px; border-radius: 16px; border: 1px solid var(--border-light); color: var(--text-main); font-size: 16px; font-family: inherit; background: var(--bg-card); transition: all 0.2s; }
                .form-input:focus, .form-select:focus, .form-textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent); }
                .form-input.field-error, .form-select.field-error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
                .field-error-msg { font-size: 12px; color: #ef4444; margin-top: 4px; display: none; }
                .field-error-msg.visible { display: block; }
                .required-label::after { content: ' *'; color: #ef4444; font-weight: 700; }
                .image-upload.field-error { border-color: #ef4444; background: rgba(239,68,68,0.04); }
                .form-select { appearance: none; background-image: url('data:image/svg+xml;utf8,<svg fill="%2371717a" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'); background-repeat: no-repeat; background-position-x: 95%; background-position-y: 50%; }
                
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .image-upload { border: 2px dashed var(--border-light); border-radius: 16px; padding: 32px; text-align: center; color: var(--text-light); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .image-upload:hover { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 5%, transparent); }
                .upload-icon { font-size: 32px; }
                .price-group { display: flex; align-items: center; gap: 12px; }
                .price-input-wrapper { position: relative; flex: 1; display: none; }
                .price-input-wrapper.visible { display: block; }
                .price-input-wrapper input { padding-right: 48px; }
                .currency { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--text-light); font-weight: 600; }
                
                @media (max-width: 600px) {
                    .form-row { grid-template-columns: 1fr; gap: 24px; }
                }
            </style>
            <section class="page-section creation-page" id="creationPage" style="display: none;">
                <header class="results-header" style="position: sticky; top: 0; z-index: 50;">
                    <div class="header-content">
                        <div class="header-title-group">
                            <button class="results-back-btn back-to-home" title="Annuler" aria-label="Annuler">
                                <i class="material-icons-round">close</i>
                            </button>
                            <div class="header-icon"><i class="material-icons-round">add_reaction</i></div>
                            <h1 class="header-title">Proposer une envie</h1>
                        </div>
                    </div>
                </header>

                <div class="page-content" style="padding: 24px; padding-bottom: 100px;">
                    <form id="creationForm" class="creation-form">
                        
                        <div class="form-group">
                            <label class="form-label required-label" for="titleInput">Titre de votre envie</label>
                            <input id="titleInput" type="text" class="form-input" placeholder="Ex: Jouer au tennis à 4..." required>
                            <span class="field-error-msg" id="titleError">Le titre est requis.</span>
                        </div>

                        <div class="form-group">
                            <label class="form-label required-label">Catégorie</label>
                            <div class="filters-container" style="flex-wrap: wrap;" id="categorySelector">
                                <span id="categoriesLoading" style="color: var(--text-light); font-size: 14px; padding: 8px;">Chargement...</span>
                            </div>
                            <span class="field-error-msg" id="categoryError">Veuillez sélectionner une catégorie.</span>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required-label" for="dateInput">Date et heure</label>
                                <input id="dateInput" type="datetime-local" class="form-input" required>
                                <span class="field-error-msg" id="dateError">La date est requise.</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label required-label" for="spotsInput">Nombre de personnes</label>
                                <input id="spotsInput" type="number" class="form-input" min="1" placeholder="Ex: 4" required>
                                <span class="field-error-msg" id="spotsError">Indiquez le nombre de participants.</span>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required-label" for="communeSelect">Commune</label>
                                <select class="form-select" id="communeSelect" required>
                                    <option value="" disabled selected>Chargement...</option>
                                </select>
                                <span class="field-error-msg" id="communeError">Veuillez choisir une commune.</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label required-label" for="addressInput">Adresse / Lieu exact</label>
                                <input id="addressInput" type="text" class="form-input" placeholder="Ex: Parc sportif, rue 12..." required>
                                <span class="field-error-msg" id="addressError">L'adresse est requise.</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Détails financiers</label>
                            <div class="financial-options" style="display: flex; flex-direction: column; gap: 12px;">
                                
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 500;">
                                    <input type="radio" name="price_type" value="free" checked style="accent-color: var(--primary); width: 18px; height: 18px;">
                                    Gratuit
                                </label>

                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 500;">
                                    <input type="radio" name="price_type" value="contribution" style="accent-color: var(--primary); width: 18px; height: 18px;">
                                    Contribution libre
                                </label>

                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 500;">
                                        <input type="radio" name="price_type" value="paid" style="accent-color: var(--primary); width: 18px; height: 18px;">
                                        Payant
                                    </label>
                                    
                                    <div id="paidSubOptions" style="display: none; flex-direction: column; gap: 10px; margin-left: 26px; padding: 12px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-light);">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-size: 14px;">
                                            <input type="radio" name="paid_sub_type" value="i_pay" checked style="accent-color: var(--primary);">
                                            Je paye
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-size: 14px;">
                                            <input type="radio" name="paid_sub_type" value="they_pay" style="accent-color: var(--primary);">
                                            <span id="theyPayLabel">L'intéressé(e) me paie</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-size: 14px;">
                                            <input type="radio" name="paid_sub_type" value="split" style="accent-color: var(--primary);">
                                            Chacun paie
                                        </label>
                                        
                                        <div class="price-input-wrapper" id="priceInputArea" style="margin-top: 8px;">
                                            <input type="number" class="form-input" id="amountInput" placeholder="Montant en FCFA" min="0" step="500">
                                            <span class="currency">FCFA</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label required-label">Image principale</label>
                            <div class="image-upload" id="mainImageUpload" title="Ajouter l'image principale">
                                <i class="material-icons-round upload-icon">add_photo_alternate</i>
                                <span style="font-weight: 600;">Ajouter une photo de couverture</span>
                                <span style="font-size: 12px;">Format paysage idéal</span>
                                <input type="file" accept="image/jpeg, image/png, image/webp" class="file-input" style="display: none;">
                            </div>
                            <span class="field-error-msg" id="imageError">Une image de couverture est requise.</span>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Plus d'images</label>
                            <div class="image-upload multiple-image-upload" title="Ajouter des images supplémentaires">
                                <i class="material-icons-round upload-icon">library_add</i>
                                <span style="font-weight: 600;">Sélectionnez plusieurs images</span>
                                <input type="file" accept="image/jpeg, image/png, image/webp" class="file-input-multiple" multiple style="display: none;">
                            </div>
                            <div id="multipleImagesPreview" style="display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 8px;"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Détails supplémentaires</label>
                            <textarea class="form-textarea" placeholder="Précisez votre envie, le niveau requis, matériel à apporter..." rows="3" style="resize: vertical;"></textarea>
                        </div>

                        <button type="submit" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 25px color-mix(in srgb, var(--primary) 40%, transparent); margin-top: 16px;">
                            <i class="material-icons-round">publish</i> Publier l'envie
                        </button>
                    </form>
                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    /** Retourne true si le formulaire contient des données non enregistrées */
    hasUnsavedContent() {
        const form = this.querySelector('#creationForm');
        if (!form) return false;
        const title = form.querySelector('#titleInput')?.value?.trim() || '';
        const date = form.querySelector('#dateInput')?.value || '';
        const address = form.querySelector('#addressInput')?.value?.trim() || '';
        const desc = form.querySelector('textarea')?.value?.trim() || '';
        const commune = form.querySelector('#communeSelect')?.value || '';
        const category = this.querySelector('#categorySelector filter-pill[active], #categorySelector filter-pill.active');
        const mainContainer = form.querySelector('#mainImageUpload') || form.querySelector('.image-upload:not(.multiple-image-upload)');
        const mainHasImage = mainContainer && mainContainer.style.backgroundImage && mainContainer.style.backgroundImage !== 'none';
        const extraPreviews = form.querySelector('#multipleImagesPreview');
        const hasExtraImages = extraPreviews && extraPreviews.children.length > 0;
        return !!(title || date || address || desc || commune || category || mainHasImage || hasExtraImages);
    }

    setupEventListeners() {
        const backBtn = this.querySelector('.back-to-home');
        if (backBtn) {
            backBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.hasUnsavedContent()) {
                    const { showConfirm } = await import('../../utils/confirm.js');
                    const ok = await showConfirm({
                        title: 'Quitter la création ?',
                        message: 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter ?',
                        confirmLabel: 'Quitter',
                        cancelLabel: 'Rester',
                        type: 'warning'
                    });
                    if (!ok) return;
                }
                const event = new CustomEvent('navigate-back', { bubbles: true, composed: true });
                this.dispatchEvent(event);
            });
        }

        // Charger catégories et communes depuis l'API au montage
        this._loadCategories();
        this._loadCommunes();

        const form = this.querySelector('#creationForm');
        if (form) {

            // Catégories exclusives — délégation sur le conteneur (les pills sont chargées dynamiquement)
            const categorySelector = this.querySelector('#categorySelector');
            if (categorySelector) {
                categorySelector.addEventListener('click', () => {
                    // Le comportement exclusif est géré dans filter-pill lui-même,
                    // mais on s'assure que cliquer sur une pill désactive les autres
                    const pills = categorySelector.querySelectorAll('filter-pill');
                    pills.forEach(p => {
                        p.addEventListener('click', () => {
                            pills.forEach(other => {
                                if (other !== p) {
                                    other.removeAttribute('active');
                                    other.classList.remove('active');
                                }
                            });
                        }, { once: false });
                    });
                });
            }

            // Logique d'affichage du champ de prix complexe
            const priceRadios = form.querySelectorAll('input[name="price_type"]');
            const paidSubOptions = this.querySelector('#paidSubOptions');
            const paidSubTypeRadios = form.querySelectorAll('input[name="paid_sub_type"]');
            const priceInputArea = this.querySelector('#priceInputArea');
            const amountInput = this.querySelector('#amountInput');
            const spotsInput = this.querySelector('#spotsInput'); // Input nombre de personnes
            const theyPayLabel = this.querySelector('#theyPayLabel');

            // Mise à jour du label "L'intéressée" ou "Les intéressés"
            if (spotsInput && theyPayLabel) {
                spotsInput.addEventListener('input', () => {
                    if (parseInt(spotsInput.value) > 2) { // > 2 signifie Toi + 2 invités = pluriel
                        theyPayLabel.textContent = "Les intéressés me paient";
                    } else {
                        theyPayLabel.textContent = "L'intéressé(e) me paie";
                    }
                });
            }

            priceRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'paid') {
                        paidSubOptions.style.display = 'flex';
                        priceInputArea.style.display = 'flex';
                        amountInput.setAttribute('required', 'true');
                    } else {
                        paidSubOptions.style.display = 'none';
                        priceInputArea.style.display = 'none';
                        amountInput.removeAttribute('required');
                    }
                });
            });

            // ── Gestion des Images (Prévisualisation) ──────────────────
            const selectedFiles = new Map(); // input element -> File pour l'image principale
            let additionalFiles = []; // Array of File objects pour les images supplémentaires

            // Image Principale
            const mainImageContainer = form.querySelector('.image-upload:not(.multiple-image-upload)');
            if (mainImageContainer) {
                const mainInput = mainImageContainer.querySelector('.file-input');
                const defaultContent = Array.from(mainImageContainer.children).filter(c => c !== mainInput);

                mainImageContainer.addEventListener('click', () => {
                    mainInput.click();
                });

                mainInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        selectedFiles.set(mainInput, file);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            mainImageContainer.style.backgroundImage = `url('${e.target.result}')`;
                            mainImageContainer.style.backgroundSize = 'cover';
                            mainImageContainer.style.backgroundPosition = 'center';
                            defaultContent.forEach(el => el.style.display = 'none');
                        };
                        reader.readAsDataURL(file);
                    } else {
                        selectedFiles.delete(mainInput);
                        mainImageContainer.style.backgroundImage = 'none';
                        defaultContent.forEach(el => el.style.display = '');
                    }
                });
            }

            // Images Multiples
            const multipleImageUpload = form.querySelector('.multiple-image-upload');
            const multipleInput = form.querySelector('.file-input-multiple');
            const multipleImagesPreview = form.querySelector('#multipleImagesPreview');

            if (multipleImageUpload && multipleInput) {
                multipleImageUpload.addEventListener('click', () => multipleInput.click());

                multipleInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (!files.length) return;

                    additionalFiles = [...additionalFiles, ...files];

                    // Rendu des miniatures
                    multipleImagesPreview.innerHTML = '';
                    additionalFiles.forEach((file, index) => {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            const div = document.createElement('div');
                            div.style.minWidth = '80px';
                            div.style.height = '80px';
                            div.style.borderRadius = '12px';
                            div.style.backgroundImage = `url('${re.target.result}')`;
                            div.style.backgroundSize = 'cover';
                            div.style.backgroundPosition = 'center';
                            div.style.position = 'relative';
                            div.style.flexShrink = '0';

                            const removeBtn = document.createElement('button');
                            removeBtn.innerHTML = '<i class="material-icons-round" style="font-size: 16px;">close</i>';
                            removeBtn.style.position = 'absolute';
                            removeBtn.style.top = '-4px';
                            removeBtn.style.right = '-4px';
                            removeBtn.style.background = '#ef4444';
                            removeBtn.style.color = 'white';
                            removeBtn.style.border = 'none';
                            removeBtn.style.borderRadius = '50%';
                            removeBtn.style.width = '24px';
                            removeBtn.style.height = '24px';
                            removeBtn.style.cursor = 'pointer';
                            removeBtn.style.display = 'flex';
                            removeBtn.style.alignItems = 'center';
                            removeBtn.style.justifyContent = 'center';

                            removeBtn.onclick = (event) => {
                                event.stopPropagation();
                                additionalFiles.splice(index, 1);
                                div.remove();
                            };

                            div.appendChild(removeBtn);
                            multipleImagesPreview.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });

                    multipleInput.value = ''; // Reset input to allow re-selection
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type="submit"]');
                const originalHtml = btn.innerHTML;

                // ── Collecte des champs ─────────────────────────────────
                const titleInput    = form.querySelector('#titleInput');
                const dateInput     = form.querySelector('#dateInput');
                const spotsInput    = form.querySelector('#spotsInput');
                const communeSelect = form.querySelector('#communeSelect');
                const addressInput  = form.querySelector('#addressInput');
                const descTextarea  = form.querySelector('textarea');
                const priceTypeRadio = form.querySelector('input[name="price_type"]:checked');
                const paidSubRadio   = form.querySelector('input[name="paid_sub_type"]:checked');
                const amountInput    = form.querySelector('#amountInput');
                const activePill     = this.querySelector('#categorySelector filter-pill[active], #categorySelector filter-pill.active');
                const category       = activePill?.dataset?.slug || null;

                // ── Validation ─────────────────────────────────────────
                const clearError = (input, errorId) => {
                    input?.classList.remove('field-error');
                    const msg = form.querySelector(`#${errorId}`) || this.querySelector(`#${errorId}`);
                    if (msg) msg.classList.remove('visible');
                };
                const showError = (input, errorId) => {
                    input?.classList.add('field-error');
                    const msg = form.querySelector(`#${errorId}`) || this.querySelector(`#${errorId}`);
                    if (msg) msg.classList.add('visible');
                    return false;
                };

                let valid = true;

                // Titre
                clearError(titleInput, 'titleError');
                if (!titleInput?.value?.trim()) { showError(titleInput, 'titleError'); valid = false; }

                // Catégorie
                const categorySelector = this.querySelector('#categorySelector');
                clearError(categorySelector, 'categoryError');
                if (!category) { showError(categorySelector, 'categoryError'); valid = false; }

                // Date
                clearError(dateInput, 'dateError');
                if (!dateInput?.value) { showError(dateInput, 'dateError'); valid = false; }

                // Spots
                clearError(spotsInput, 'spotsError');
                if (!spotsInput?.value || parseInt(spotsInput.value) < 1) { showError(spotsInput, 'spotsError'); valid = false; }

                // Commune
                clearError(communeSelect, 'communeError');
                if (!communeSelect?.value) { showError(communeSelect, 'communeError'); valid = false; }

                // Adresse
                clearError(addressInput, 'addressError');
                if (!addressInput?.value?.trim()) { showError(addressInput, 'addressError'); valid = false; }

                // Image principale (skip in edit mode if existing images present)
                const mainUpload = form.querySelector('#mainImageUpload') || form.querySelector('.image-upload:not(.multiple-image-upload)');
                clearError(mainUpload, 'imageError');
                const hasExisting = this._editMode && this._existingImages && this._existingImages.length > 0;
                if (selectedFiles.size === 0 && !hasExisting) { showError(mainUpload, 'imageError'); valid = false; }

                if (!valid) {
                    // Scroller jusqu'au premier champ en erreur
                    const firstErr = form.querySelector('.field-error, .image-upload.field-error');
                    firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Envoi des images...';

                try {
                    const { api } = await import('../../api.js');
                    if (!api.isAuthenticated()) throw new Error('Connectez-vous pour publier une envie');

                    // 1. Upload des images vers S3
                    const mainImageUrls = [];
                    const additionalImageUrls = [];
                    for (const [input, file] of selectedFiles.entries()) {
                        try {
                            const url = await api.uploadToS3(file);
                            mainImageUrls.push(url);
                        } catch (imgErr) {
                            console.error('Erreur upload image principale', file.name, imgErr);
                            throw new Error(`Erreur image principale ${file.name}: ${imgErr.message}`);
                        }
                    }
                    for (const file of additionalFiles) {
                        try {
                            const url = await api.uploadToS3(file);
                            additionalImageUrls.push(url);
                        } catch (imgErr) {
                            console.error('Erreur upload image supp', file.name, imgErr);
                            throw new Error(`Erreur image suppl ${file.name}: ${imgErr.message}`);
                        }
                    }
                    const uploadedImageUrls = [...mainImageUrls, ...additionalImageUrls];

                    btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Publication...';

                    // 2. Création du payload
                    const payload = {
                        title: titleInput.value.trim(),
                        category,
                        commune: communeSelect.value,
                        address: addressInput.value.trim(),
                        event_date: new Date(dateInput.value).toISOString(),
                        max_spots: parseInt(spotsInput.value),
                        price_type: priceTypeRadio?.value || 'free',
                        pay_mode: paidSubRadio?.value || null,
                        price_amount: amountInput?.value ? parseInt(amountInput.value) : null,
                        description: descTextarea?.value?.trim() || null,
                        images: uploadedImageUrls,
                    };

                    if (this._editMode && this._editDesireId) {
                        btn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</i> Mise à jour...';
                        const existing = this._existingImages || [];
                        const finalMain = mainImageUrls.length > 0 ? mainImageUrls : existing.slice(0, 1);
                        const finalAdditional = additionalImageUrls.length > 0 ? additionalImageUrls : existing.slice(1);
                        const finalImages = [...finalMain, ...finalAdditional];
                        if (finalImages.length > 0) {
                            payload.images = finalImages;
                        } else {
                            delete payload.images;
                        }
                        await api.updateDesire(this._editDesireId, payload);
                        btn.style.background = '#10b981';
                        btn.innerHTML = '<i class="material-icons-round">check</i> Mis à jour !';
                    } else {
                        const created = await api.createDesire(payload);
                        btn.style.background = '#10b981';
                        btn.innerHTML = '<i class="material-icons-round">check</i> Publié !';

                        setTimeout(() => {
                            btn.disabled = false;
                            btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                            btn.innerHTML = `<i class="material-icons-round">publish</i> Publier l'envie`;
                            form.reset();

                            // Reset state
                            this._editMode = false;
                            this._editDesireId = null;

                            // Reset image previews
                            selectedFiles.clear();
                            if (mainImageContainer) {
                                mainImageContainer.style.backgroundImage = 'none';
                                Array.from(mainImageContainer.children).forEach(el => {
                                    if (el.tagName !== 'INPUT') el.style.display = '';
                                });
                            }

                            additionalFiles = [];
                            if (multipleImagesPreview) multipleImagesPreview.innerHTML = '';

                            // Reset UI elements like price area
                            if (priceInputArea) priceInputArea.style.display = 'none';
                            if (paidSubOptions) paidSubOptions.style.display = 'none';
                            if (amountInput) amountInput.removeAttribute('required');

                            // Nouvelle envie : rafraîchir l'explorateur, rediriger vers le profil et ouvrir l'envie créée
                            const newId = created?.id ?? created?.data?.id;
                            window.dispatchEvent(new CustomEvent('refresh-explorer', { bubbles: true, composed: true }));
                            window.dispatchEvent(new CustomEvent('navigate-profile', { bubbles: true, composed: true }));
                            if (newId) {
                                setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent('view-desire', { detail: { id: newId }, bubbles: true, composed: true }));
                                }, 150);
                            }
                        }, 1200);
                        return;
                    }

                    setTimeout(() => {
                        btn.disabled = false;
                        btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                        btn.innerHTML = `<i class="material-icons-round">publish</i> Publier l'envie`;
                        form.reset();

                        // Reset state
                        this._editMode = false;
                        this._editDesireId = null;

                        // Reset image previews
                        selectedFiles.clear();
                        if (mainImageContainer) {
                            mainImageContainer.style.backgroundImage = 'none';
                            Array.from(mainImageContainer.children).forEach(el => {
                                if (el.tagName !== 'INPUT') el.style.display = '';
                            });
                        }

                        additionalFiles = [];
                        if (multipleImagesPreview) multipleImagesPreview.innerHTML = '';

                        // Reset UI elements like price area
                        if (priceInputArea) priceInputArea.style.display = 'none';
                        if (paidSubOptions) paidSubOptions.style.display = 'none';
                        if (amountInput) amountInput.removeAttribute('required');

                        const event = new CustomEvent('navigate-back', { bubbles: true, composed: true });
                        this.dispatchEvent(event);
                    }, 1200);

                } catch (err) {
                    btn.disabled = false;
                    btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                    btn.innerHTML = originalHtml;
                    const msg = (err && err.message) ? String(err.message) : '';
                    let friendly = msg;
                    if (msg.includes('upload') || msg.includes('S3') || msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch'))
                        friendly = 'Échec de l\'upload des images. Vérifiez votre connexion.';
                    else if (msg.includes('401') || msg.includes('Connectez') || msg.includes('authentif'))
                        friendly = 'Session expirée. Reconnectez-vous.';
                    else if (msg.length > 55) friendly = 'Une erreur est survenue. Réessayez.';
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: friendly, type: 'error' }, bubbles: true, composed: true }));
                }
            });
        }
    }

    async edit(data) {
        const desireId = data.desireId;
        if (!desireId) return;

        const editToken = Symbol();
        this._editToken = editToken;
        this._editMode = true;
        this._editDesireId = desireId;

        const pageContent = this.querySelector('.page-content');
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'edit-loading-overlay';
        loadingOverlay.style.cssText = [
            'position:absolute', 'inset:0',
            'background:var(--bg-main,#fff)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'z-index:20'
        ].join(';');
        loadingOverlay.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;color:var(--text-light);">
                <i class="material-icons-round" style="font-size:40px;animation:spin 1s linear infinite;color:var(--primary);">autorenew</i>
                <span style="font-size:14px;font-weight:500;">Chargement de l'annonce...</span>
            </div>`;
        if (pageContent) {
            pageContent.style.position = 'relative';
            pageContent.appendChild(loadingOverlay);
        }

        try {
            const { api } = await import('../../api.js');
            const desire = await api.getDesire(desireId);

            if (this._editToken !== editToken) {
                loadingOverlay.remove();
                return;
            }

            const form = this.querySelector('#creationForm');
            if (!form) { loadingOverlay.remove(); return; }

            const titleInput = form.querySelector('#titleInput');
            if (titleInput) titleInput.value = desire.title || '';

            const pills = this.querySelectorAll('#categorySelector filter-pill');
            pills.forEach(p => {
                p.classList.remove('active');
                p.removeAttribute('active');
            });
            if (desire.category) {
                const targetPill = Array.from(pills).find(p => p.dataset.slug === desire.category);
                if (targetPill) targetPill.setAttribute('active', 'true');
            }

            const dateInput = form.querySelector('input[type="datetime-local"]');
            if (dateInput && desire.event_date) {
                const d = new Date(desire.event_date);
                dateInput.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }

            const spotsInput = form.querySelector('#spotsInput');
            if (spotsInput) spotsInput.value = desire.max_spots || '';

            const communeSelect = form.querySelector('#communeSelect');
            if (communeSelect && desire.commune) communeSelect.value = desire.commune;

            const addressInput = form.querySelector('#addressInput');
            if (addressInput && desire.address) addressInput.value = desire.address;

            const descTextarea = form.querySelector('textarea');
            if (descTextarea && desire.description) descTextarea.value = desire.description;

            const priceRadios = form.querySelectorAll('input[name="price_type"]');
            priceRadios.forEach(r => {
                if (r.value === desire.price_type) r.checked = true;
                r.dispatchEvent(new Event('change'));
            });

            if (desire.price_type === 'paid') {
                const subRadios = form.querySelectorAll('input[name="paid_sub_type"]');
                subRadios.forEach(r => {
                    if (r.value === desire.pay_mode) r.checked = true;
                });
                const amountInput = form.querySelector('#amountInput');
                if (amountInput) amountInput.value = desire.price_amount || '';
            }

            // Existing images
            this._existingImages = desire.images || [];
            if (this._existingImages.length > 0) {
                const mainImageContainer = form.querySelector('.image-upload:not(.multiple-image-upload)');
                if (mainImageContainer) {
                    mainImageContainer.style.backgroundImage = `url('${this._existingImages[0]}')`;
                    mainImageContainer.style.backgroundSize = 'cover';
                    mainImageContainer.style.backgroundPosition = 'center';
                    mainImageContainer.style.minHeight = '160px';
                    Array.from(mainImageContainer.children).forEach(el => {
                        if (el.tagName !== 'INPUT') el.style.display = 'none';
                    });
                }

                if (this._existingImages.length > 1) {
                    const preview = form.querySelector('#multipleImagesPreview');
                    if (preview) {
                        preview.innerHTML = '';
                        this._existingImages.slice(1).forEach(url => {
                            const div = document.createElement('div');
                            div.style.cssText = 'min-width:80px;height:80px;border-radius:12px;background-size:cover;background-position:center;flex-shrink:0;';
                            div.style.backgroundImage = `url('${url}')`;
                            preview.appendChild(div);
                        });
                    }
                }
            }

            const btn = form.querySelector('button[type="submit"]');
            if (btn) btn.innerHTML = '<i class="material-icons-round">save</i> Mettre à jour';

            const headerTitle = this.querySelector('.header-title');
            if (headerTitle) headerTitle.textContent = 'Modifier l\'envie';

            loadingOverlay.remove();
        } catch (err) {
            loadingOverlay.remove();
            console.error('Erreur chargement édition', err);
            alert("Impossible de charger l'annonce pour édition");
        }
    }

    async _loadCategories() {
        const selector = this.querySelector('#categorySelector');
        if (!selector) return;
        try {
            const { api } = await import('../../api.js');
            const raw = await api.getCategoriesFull();
            const items = Array.isArray(raw) ? raw.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)) : [];
            const loading = selector.querySelector('#categoriesLoading');
            if (loading) loading.remove();
            if (items.length > 0) {
                items.forEach((cat, idx) => {
                    const pill = document.createElement('filter-pill');
                    pill.setAttribute('icon', cat.icon || 'label');
                    pill.setAttribute('interactive', '');
                    pill.setAttribute('text', cat.label || cat.slug || '');
                    pill.dataset.slug = cat.slug;
                    if (idx === 0) pill.setAttribute('active', 'true');
                    pill.addEventListener('click', () => {
                        selector.querySelectorAll('filter-pill').forEach(p => {
                            if (p !== pill) { p.removeAttribute('active'); p.classList.remove('active'); }
                        });
                    });
                    selector.appendChild(pill);
                });
            }
        } catch (e) {
            console.warn('[CreationPage] Catégories non chargées:', e.message);
        }
    }

    async _loadCommunes() {
        const select = this.querySelector('#communeSelect');
        if (!select) return;
        try {
            const { api } = await import('../../api.js');
            const items = await api.getCommunesFull();
            select.innerHTML = '<option value="" disabled selected>Sélectionnez une commune</option>';
            if (Array.isArray(items) && items.length > 0) {
                items.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.label;
                    opt.textContent = c.label;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('[CreationPage] Communes non chargées:', e.message);
            // Fallback statique si l'API échoue
            const fallback = ['Abobo','Adjamé','Attécoubé','Cocody','Koumassi','Marcory','Plateau','Port-Bouët','Treichville','Yopougon','Bingerville','Songon','Anyama'];
            select.innerHTML = '<option value="" disabled selected>Sélectionnez une commune</option>';
            fallback.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                select.appendChild(opt);
            });
        }
    }

    show() {
        this.querySelector('#creationPage').style.display = 'block';
        if (this._pendingEdit) {
            const data = this._pendingEdit;
            this._pendingEdit = null;
            this.edit(data);
        }
    }

    hide() {
        this.querySelector('#creationPage').style.display = 'none';

        this._editToken = null;
        this._editMode = false;
        this._editDesireId = null;
        this._existingImages = null;

        const overlay = this.querySelector('.edit-loading-overlay');
        if (overlay) overlay.remove();

        const headerTitle = this.querySelector('.header-title');
        if (headerTitle) headerTitle.textContent = 'Proposer une envie';

        const form = this.querySelector('#creationForm');
        if (form) {
            const btn = form.querySelector('button[type="submit"]');
            if (btn) btn.innerHTML = `<i class="material-icons-round">publish</i> Publier l'envie`;
            form.reset();
            const mainContainer = this.querySelector('.image-upload:not(.multiple-image-upload)');
            if (mainContainer) {
                mainContainer.style.backgroundImage = 'none';
                Array.from(mainContainer.children).forEach(el => {
                    if (el.tagName !== 'INPUT') el.style.display = '';
                });
            }
            const preview = this.querySelector('#multipleImagesPreview');
            if (preview) preview.innerHTML = '';
        }
    }
}

customElements.define('app-creation-page', CreationPage);
