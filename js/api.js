/**
 * api.js — Client HTTP centralisé pour l'API Dystrax (FastAPI)
 * Base URL : http://127.0.0.1:8000/api/v1
 *
 * Gestion du token JWT :
 *   - Stocké dans localStorage sous la clé "dystrax-token"
 *   - Injecté automatiquement dans Authorization: Bearer <token>
 */

// En dev : proxy Vite (/api). En prod : définir VITE_API_URL (ex. https://api.example.com/api/v1)
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '/api/v1';

// ── Helpers internes ─────────────────────────────────────────────

// Clés de stockage du contexte pays (contrainte DEC-03 : jeton en en-tête).
const COUNTRY_CONTEXT_KEY = 'dystrax-country-context';
const COUNTRY_CODE_KEY = 'dystrax-country-code';

function getToken() {
    return localStorage.getItem('dystrax-token');
}

function setToken(token) {
    localStorage.setItem('dystrax-token', token);
}

function removeToken() {
    localStorage.removeItem('dystrax-token');
    localStorage.removeItem('dystrax-user');
    // Une déconnexion supprime le contexte lié au compte précédent (VIS-10).
    clearCountryContext();
}

function isAuthenticated() {
    return !!getToken();
}

function buildHeaders(extra = {}, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Transport du contexte pays sur toutes les routes applicatives ;
    // les routes d'authentification le désactivent explicitement.
    if (options.withCountry !== false) {
        const countryContext = getCountryContextToken();
        if (countryContext) headers['X-Country-Context'] = countryContext;
    }
    return headers;
}

// ── Contexte pays ────────────────────────────────────────────────

/** Jeton signé du contexte pays, transporté via X-Country-Context. */
function getCountryContextToken() {
    return localStorage.getItem(COUNTRY_CONTEXT_KEY);
}

/** Code du pays effectif, conservé pour isoler les caches et l'affichage. */
function getCountryCode() {
    return localStorage.getItem(COUNTRY_CODE_KEY) || null;
}

/**
 * Aligne la réponse de contexte de l'API sur la forme attendue par l'app.
 *
 * L'API expose `effective_country_code` et `context_token` (§14 du cahier des
 * charges). On les traduit ici en `country_code` et `token` pour le reste de
 * l'app, et `needs_choice` signale l'absence de pays utilisable (choix manuel
 * requis). Les champs d'origine (source, detected_country_code,
 * confirmation_required, can_confirm) sont conservés pour l'affichage.
 */
function normalizeCountryContext(data) {
    if (!data) return data;
    const countryCode = data.effective_country_code || null;
    return {
        ...data,
        country_code: countryCode,
        token: data.context_token || null,
        needs_choice: !countryCode,
    };
}

/** Mémorise le contexte renvoyé par l'API (jeton et pays effectif). */
function rememberCountryContext(data) {
    if (!data) return;
    if (data.token) localStorage.setItem(COUNTRY_CONTEXT_KEY, data.token);
    if (data.country_code) localStorage.setItem(COUNTRY_CODE_KEY, data.country_code);
    else localStorage.removeItem(COUNTRY_CODE_KEY);
}

/** Caches locaux dépendants du pays : toute clé inclut le code pays (VIS-10). */
const _countryCaches = new Map();

/**
 * Exécute un chargement paresseux mis en cache pour un couple
 * (ressource, code pays). Chaque entrée retient l'AbortController qui l'a
 * produite : purger le cache invalide donc aussi les requêtes en vol, et une
 * réponse tardive d'un ancien pays ne peut plus être consommée (VIS-11).
 */
async function withCountryCache(resource, countryCode, loader) {
    const key = `${resource}:${countryCode || 'neutral'}`;
    const existing = _countryCaches.get(key);
    if (existing) {
        return existing.value !== undefined ? existing.value : existing.promise;
    }
    const controller = new AbortController();
    const entry = { controller, value: undefined, promise: null };
    _countryCaches.set(key, entry);
    entry.promise = loader(controller.signal)
        .then((value) => {
            entry.value = value;
            entry.promise = null;
            return value;
        })
        .catch((err) => {
            _countryCaches.delete(key);
            throw err;
        });
    return entry.promise;
}

function purgeCountryCaches() {
    // Interrompt les requêtes en vol : leurs réponses deviennent obsolètes.
    for (const entry of _countryCaches.values()) entry.controller.abort();
    _countryCaches.clear();
}

/** Purge les caches si le pays effectif a changé depuis le dernier appel. */
function purgeCountryCachesIfChanged(countryCode) {
    if ((countryCode || null) !== getCountryCode()) purgeCountryCaches();
}

/** Supprime le contexte pays (déconnexion, changement de compte). */
function clearCountryContext() {
    localStorage.removeItem(COUNTRY_CONTEXT_KEY);
    localStorage.removeItem(COUNTRY_CODE_KEY);
    purgeCountryCaches();
}

async function handleResponse(res) {
    if (res.ok) {
        if (res.status === 204) return null;
        return res.json();
    }
    if (res.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-required'));
        }
    }
    let detail = `Erreur ${res.status}`;
    try {
        const err = await res.json();
        if (Array.isArray(err.detail)) {
            // FastAPI 422 validation errors: [{loc, msg, type}, ...]
            detail = err.detail.map(e => e.msg).join(' — ');
        } else if (err.detail) {
            detail = err.detail;
        }
    } catch (_) { }
    throw new Error(detail);
}

// ── Auth ─────────────────────────────────────────────────────────

export const api = {

    // ── Authentification ────────────────────────────────────────

    /**
     * Inscription : POST /auth/register
     * @returns {Promise<{id, pseudo, phone, avatar_url, created_at}>}
     */
    async register(pseudo, phone, password) {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: buildHeaders({}, { withCountry: false }),
            body: JSON.stringify({ pseudo, phone, password }),
        });
        return handleResponse(res);
    },

    /**
     * Vérification OTP : POST /auth/verify-otp
     * @param {string} phone - Numéro de téléphone
     * @param {string} otpCode - Code OTP reçu par SMS/WhatsApp
     * @returns {Promise<{message: string}>}
     */
    async verifyOtp(phone, otpCode) {
        const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: buildHeaders({}, { withCountry: false }),
            body: JSON.stringify({ phone, otp_code: otpCode }),
        });
        return handleResponse(res);
    },

    /**
     * Connexion : POST /auth/login (OAuth2PasswordRequestForm)
     * Stocke le JWT en localStorage après succès.
     * @param {string} identifier - Numéro de téléphone ou adresse email du compte
     * @param {string} password - Mot de passe
     * @returns {Promise<{access_token, token_type}>}
     */
    async login(identifier, password) {
        // Encodage explicite pour éviter tout problème avec @, &, +, etc. dans le mot de passe
        const body = `username=${encodeURIComponent(identifier)}&password=${encodeURIComponent(password)}`;
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data = await handleResponse(res);
        setToken(data.access_token);
        return data;
    },

    /**
     * Connexion avec Google : POST /auth/google
     * @param {string} idToken - Token d'identité reçu depuis Google Identity Services
     * @returns {Promise<{access_token, token_type}>}
     */
    async loginWithGoogle(idToken) {
        const res = await fetch(`${BASE_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
        });
        // Un 401 ici signifie « token Google refusé », pas « session expirée ».
        // On n'utilise donc pas handleResponse : il déclencherait 'auth-required'
        // et redirigerait brutalement l'utilisateur (ex. depuis l'inscription).
        if (!res.ok) {
            let detail = `Erreur ${res.status}`;
            try {
                const err = await res.json();
                if (err && typeof err.detail === 'string') detail = err.detail;
            } catch (_) { /* corps non JSON : on garde le message générique */ }
            throw new Error(detail);
        }
        const data = await res.json();
        if (data.access_token) {
            setToken(data.access_token);
        }
        return data;
    },

    /** Déconnexion : supprime le token du localStorage */
    logout() {
        removeToken();
    },

    /**
     * Mot de passe oublié : POST /auth/forgot-password
     * @param {string} identifier - Numéro de téléphone ou adresse email du compte
     * @returns {Promise<{message?: string}>}
     */
    async forgotPassword(identifier) {
        const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: buildHeaders({}, { withCountry: false }),
            body: JSON.stringify({ identifier: String(identifier).trim() }),
        });
        return handleResponse(res);
    },

    /**
     * Réinitialisation du mot de passe : POST /auth/reset-password
     * @param {string} token - Token reçu par lien ou SMS
     * @param {string} new_password - Nouveau mot de passe
     * @returns {Promise<{message?: string}>}
     */
    async resetPassword(token, new_password) {
        const res = await fetch(`${BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: buildHeaders({}, { withCountry: false }),
            body: JSON.stringify({ token: String(token).trim(), new_password: String(new_password) }),
        });
        return handleResponse(res);
    },

    isAuthenticated,

    // ── Géographie : contexte pays ──────────────────────────────

    /** Code pays effectif mémorisé localement (lecture synchrone). */
    getCountryCode,

    /**
     * GET /geography/context — Contexte pays effectif (auth optionnelle)
     * Renvoie { country_code, source, country, token, needs_choice }. Le jeton
     * est mémorisé pour être transporté en en-tête sur les appels suivants.
     * @param {Object} [options] - { signal }
     * @returns {Promise<{country_code, source, country, token, needs_choice}>}
     */
    async getCountryContext(options = {}) {
        const res = await fetch(`${BASE_URL}/geography/context`, {
            headers: buildHeaders(),
            signal: options.signal,
        });
        const data = normalizeCountryContext(await handleResponse(res));
        // Un pays résolu différent du précédent rend les caches caducs (VIS-10).
        purgeCountryCachesIfChanged(data?.country_code);
        rememberCountryContext(data);
        return data;
    },

    /**
     * POST /geography/context — Choix ou correction explicite du pays
     * @param {string} countryCode - Code pays, ex. « CI »
     * @returns {Promise<{country_code, source, country, token, needs_choice}>}
     */
    async setCountryContext(countryCode) {
        const res = await fetch(`${BASE_URL}/geography/context`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ country_code: countryCode }),
        });
        const data = normalizeCountryContext(await handleResponse(res));
        // Après succès, les caches locaux dépendants de l'ancien pays sont purgés
        // et les requêtes en vol invalidées avant de mémoriser le nouveau contexte.
        purgeCountryCaches();
        rememberCountryContext(data);
        return data;
    },

    /**
     * GET /geography/countries — Pays proposés dans le sélecteur
     * @returns {Promise<Array<{code, label, is_active}>>}
     */
    async getCountries() {
        return withCountryCache('countries', null, async (signal) => {
            const res = await fetch(`${BASE_URL}/geography/countries`, {
                headers: buildHeaders(),
                signal,
            });
            const data = await handleResponse(res);
            return Array.isArray(data) ? data : (data?.countries || []);
        });
    },

    /**
     * GET /geography/cities — Villes/communes du pays effectif (VIS-04)
     * @param {string} [countryCode] - Par défaut le pays du contexte courant
     * @returns {Promise<Array<{id, country_code, label, slug}>>}
     */
    async getCities(countryCode) {
        const code = countryCode || getCountryCode();
        const params = new URLSearchParams();
        if (code) params.set('country_code', code);
        return withCountryCache('cities', code, async (signal) => {
            const res = await fetch(`${BASE_URL}/geography/cities?${params}`, {
                headers: buildHeaders(),
                signal,
            });
            const data = await handleResponse(res);
            return Array.isArray(data) ? data : (data?.cities || []);
        });
    },

    // ── Utilisateur courant ─────────────────────────────────────

    /**
     * GET /users/me — Profil de l'utilisateur connecté
     */
    async getMe() {
        const res = await fetch(`${BASE_URL}/users/me`, {
            headers: buildHeaders(),
        });
        const user = await handleResponse(res);
        if (user) localStorage.setItem('dystrax-user', JSON.stringify(user));
        return user;
    },

    /**
     * PATCH /users/me — Mise à jour du profil
     */
    async updateMe(fields) {
        const res = await fetch(`${BASE_URL}/users/me`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify(fields),
        });
        return handleResponse(res);
    },

    /**
     * GET /users/me/desires — Mes envies créées
     */
    async getMyDesires() {
        const res = await fetch(`${BASE_URL}/users/me/desires`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * GET /users/me/joined — Mes envies rejointes
     */
    async getJoinedDesires() {
        const res = await fetch(`${BASE_URL}/users/me/joined`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    // ── Envies ──────────────────────────────────────────────────

    /**
     * GET /desires — Liste filtrée des envies
     * La commune est un libellé du pays courant : le client n'impose jamais de
     * pays, c'est le contexte (X-Country-Context) qui borne le catalogue.
     * @param {Object} filters - { query, category, commune, price_type, date, page, size }
     * @param {Object} [options] - { signal } pour invalider une requête obsolète
     */
    async fetchDesires(filters = {}, options = {}) {
        const params = new URLSearchParams();
        if (filters.query) params.set('query', filters.query);
        if (filters.category) params.set('category', filters.category);
        if (filters.exclude_category) params.set('exclude_category', filters.exclude_category);
        if (filters.commune) params.set('commune', filters.commune);
        if (filters.price_type) params.set('price_type', filters.price_type);
        if (filters.date) params.set('date', filters.date);
        params.set('page', filters.page || 1);
        params.set('size', filters.size || 20);

        const res = await fetch(`${BASE_URL}/desires?${params}`, {
            headers: buildHeaders(),
            signal: options.signal,
        });
        return handleResponse(res);
    },

    /**
     * GET /desires/:id — Détails d'une envie
     */
    async getDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/view — Enregistre une vue sur une envie (comptage)
     * Appel fire-and-forget recommandé pour ne pas bloquer l'affichage.
     */
    async recordDesireView(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/view`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        if (!res.ok) return;
        return res.json().catch(() => null);
    },

    /**
     * POST /desires — Créer une envie [auth]
     */
    async createDesire(data) {
        const res = await fetch(`${BASE_URL}/desires`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    /**
     * PATCH /desires/:id — Modifier une envie [auth + owner]
     */
    async updateDesire(id, data) {
        const res = await fetch(`${BASE_URL}/desires/${id}`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/join — Rejoindre une envie [auth]
     */
    async joinDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/join`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * DELETE /desires/:id/join — Quitter une envie [auth]
     */
    async leaveDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/join`, {
            method: 'DELETE',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/like — Aimer une envie [auth]
     * @returns {Promise<{liked: boolean, like_count: number}>}
     */
    async likeDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/like`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * DELETE /desires/:id/like — Retirer son like [auth]
     * @returns {Promise<{liked: boolean, like_count: number}>}
     */
    async unlikeDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/like`, {
            method: 'DELETE',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * GET /desires/:id/participants — Liste des participants d'une envie [auth + owner]
     * @returns {Promise<Array<{id, pseudo, avatar_url, joined_at, status}>>}
     */
    async getDesireParticipants(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/participants`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/participants/:userId/accept — Accepter un participant [auth + owner]
     */
    async acceptParticipant(desireId, userId) {
        const res = await fetch(`${BASE_URL}/desires/${desireId}/participants/${userId}/accept`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/participants/:userId/reject — Refuser un participant [auth + owner]
     */
    async rejectParticipant(desireId, userId) {
        const res = await fetch(`${BASE_URL}/desires/${desireId}/participants/${userId}/reject`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/confirm — Confirmer sa présence après acceptation [auth]
     */
    async confirmPresence(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/confirm`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /desires/:id/keep — Confirmer le maintien de l'activité [auth + owner] (ORG-08)
     */
    async keepDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}/keep`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * DELETE /desires/:id — Supprimer une envie [auth + owner]
     */
    async deleteDesire(id) {
        const res = await fetch(`${BASE_URL}/desires/${id}`, {
            method: 'DELETE',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    // ── Suggestions & Filtres ───────────────────────────────────

    /**
     * GET /filters/suggestions?q= — Suggestions typewriter
     */
    async fetchSuggestions(query) {
        const res = await fetch(`${BASE_URL}/filters/search/suggestions?q=${encodeURIComponent(query)}`, {
            headers: buildHeaders(),
        });
        const data = await handleResponse(res);
        return data?.suggestions || [];
    },

    /**
     * GET /filters/categories — Catégories actives (slugs)
     * @returns {Promise<string[]>}
     */
    async getCategories() {
        const res = await fetch(`${BASE_URL}/filters/categories`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.categories || [];
    },

    /**
     * GET /filters/categories — Catégories actives complètes (slug + label + icon)
     * @returns {Promise<Array<{slug, label, icon, sort_order}>>}
     */
    async getCategoriesFull() {
        const res = await fetch(`${BASE_URL}/filters/categories`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.items || [];
    },

    /**
     * GET /filters/communes — Communes actives (labels)
     * @returns {Promise<string[]>}
     */
    async getCommunes() {
        const res = await fetch(`${BASE_URL}/filters/communes`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.communes || [];
    },

    /**
     * GET /filters/communes — Communes actives complètes (slug + label)
     * @returns {Promise<Array<{slug, label, sort_order}>>}
     */
    async getCommunesFull() {
        const res = await fetch(`${BASE_URL}/filters/communes`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.items || [];
    },

    /**
     * GET /filters/price-types — Types de prix actifs
     * @returns {Promise<Array<{slug, label, icon, description}>>}
     */
    async getPriceTypes() {
        const res = await fetch(`${BASE_URL}/filters/price-types`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.price_types || [];
    },

    /**
     * GET /filters/pay-modes — Modes de paiement actifs
     * @returns {Promise<Array<{slug, label, description}>>}
     */
    async getPayModes() {
        const res = await fetch(`${BASE_URL}/filters/pay-modes`, { headers: buildHeaders() });
        const data = await handleResponse(res);
        return data?.pay_modes || [];
    },

    // ── Boosts ──────────────────────────────────────────────────

    /**
     * GET /boosts/plans — Plans de boost disponibles
     */
    async getBoostPlans() {
        const res = await fetch(`${BASE_URL}/boosts/plans`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /boosts/zones — Zones de boost disponibles
     * @returns {Promise<Array<{id, label, price_multiplier}>>}
     */
    async getBoostZones() {
        const res = await fetch(`${BASE_URL}/boosts/zones`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /boosts/options — Options de boost disponibles (ex: Boost RS)
     * Retourne les options avec zone_surcharges et social_networks.
     * @returns {Promise<Array<{slug, label, description, base_price_xof, duration_hours, icon, zone_surcharges, social_networks}>>}
     */
    async getBoostOptions() {
        const res = await fetch(`${BASE_URL}/boosts/options`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * POST /boosts — Activer un boost [auth]
     * @param {Object} data - { desire_id, duration_id, zone, notify_interested, priority_position }
     */
    async activateBoost(data) {
        const res = await fetch(`${BASE_URL}/boosts`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    /**
     * GET /boosts/my — Mes boosts actifs [auth]
     */
    async getMyBoosts() {
        const res = await fetch(`${BASE_URL}/boosts/my`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /boosts/active/{desireId} — Boost actif pour une envie [auth]
     * @param {string} desireId - UUID de l'envie
     * @returns {Promise<{id, desire_id, duration_hours, zone, price_xof, activated_at, expires_at}>}
     */
    async getActiveBoost(desireId) {
        const res = await fetch(`${BASE_URL}/boosts/active/${desireId}`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /features — Liste de toutes les fonctionnalités (actives + inactives)
     * @param {string} [domain] - Filtrer par domaine (optionnel)
     * @returns {Promise<{features: Array, total: number}>}
     */
    async getFeatures(domain) {
        const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
        const res = await fetch(`${BASE_URL}/features${params}`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * PATCH /features/:slug — Bascule une fonctionnalité [admin]
     * Voie des interrupteurs simples : arrêt d'urgence du moteur, plage de
     * tranquillité, plafond quotidien (MNO-05, MNO-12).
     * @returns {Promise<{slug, label, description, is_active}>}
     */
    async setFeatureActive(slug, isActive) {
        const res = await fetch(`${BASE_URL}/features/${encodeURIComponent(slug)}`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify({ is_active: Boolean(isActive) }),
        });
        return handleResponse(res);
    },

    // ── Console d'administration (MNO-12) ────────────────────────
    // Toutes ces routes sont réservées aux comptes habilités : l'API répond 403
    // à un compte ordinaire, la garde côté interface n'est qu'un confort.

    /** GET /admin/targeting — Mode de gratuité du ciblage en vigueur + options */
    async getAdminTargeting() {
        const res = await fetch(`${BASE_URL}/admin/targeting`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /** PUT /admin/targeting — Choisit le mode de gratuité du ciblage [admin] */
    async setAdminTargeting(mode) {
        const res = await fetch(`${BASE_URL}/admin/targeting`, {
            method: 'PUT',
            headers: buildHeaders(),
            body: JSON.stringify({ mode }),
        });
        return handleResponse(res);
    },

    /** GET /admin/users?q= — Recherche un compte par pseudo ou téléphone [admin] */
    async searchAdminUsers(query, limit = 20) {
        const params = new URLSearchParams({ q: String(query).trim(), limit: String(limit) });
        const res = await fetch(`${BASE_URL}/admin/users?${params}`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /** GET /admin/users/:id/journal — Livraisons et file d'un compte [admin] */
    async getAdminUserJournal(userId, limit = 20) {
        const params = new URLSearchParams({ limit: String(limit) });
        const res = await fetch(`${BASE_URL}/admin/users/${userId}/journal?${params}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /** GET /admin/users/:id/diagnostic — Causes probables d'un non-envoi [admin] */
    async getAdminUserDiagnostic(userId) {
        const res = await fetch(`${BASE_URL}/admin/users/${userId}/diagnostic`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /** POST /admin/users/:id/test — Envoie un push de vérification [admin] */
    async sendAdminTestNotification(userId) {
        const res = await fetch(`${BASE_URL}/admin/users/${userId}/test`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /** GET /admin/outbox — Répartition de la file d'envoi par statut [admin] */
    async getAdminOutbox() {
        const res = await fetch(`${BASE_URL}/admin/outbox`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /admin/outbox/entries — Envois individuels de la file [admin]
     * Chaque carte porte son destinataire et le CTA natif transporté par
     * l'envoi (action_label / action_target), relu sous les mêmes clés que
     * l'appareil.
     * @param {{status?: string, campaign_id?: string, limit?: number, offset?: number}} [filters]
     * @returns {Promise<{entries: Array<Object>, total: number}>}
     */
    async getAdminOutboxEntries(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.campaign_id) params.set('campaign_id', filters.campaign_id);
        if (filters.limit) params.set('limit', String(filters.limit));
        if (filters.offset) params.set('offset', String(filters.offset));
        const res = await fetch(`${BASE_URL}/admin/outbox/entries?${params}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * GET /admin/outbox/entries/:id — Détail d'un envoi de la file [admin]
     * La ligne est relue à l'ouverture : son statut peut avoir changé depuis la liste.
     * @param {string} outboxId
     * @returns {Promise<Object>}
     */
    async getAdminOutboxEntry(outboxId) {
        const res = await fetch(`${BASE_URL}/admin/outbox/entries/${encodeURIComponent(outboxId)}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /** GET /admin/stats — Statistiques de plateforme [admin] */
    async getAdminStats() {
        const res = await fetch(`${BASE_URL}/admin/stats`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /admin/settings — Réglages de plateforme (MNO-15)
     * Chaque entrée porte sa clé, son libellé, son type et sa valeur.
     * @returns {Promise<{settings: Array<{key, label, kind, hint, value}>}>}
     */
    async getAdminSettings() {
        const res = await fetch(`${BASE_URL}/admin/settings`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * PUT /admin/settings — Modifie les réglages de plateforme [admin]
     * @param {Object} values - Valeurs indexées par clé (envoi partiel accepté)
     * @returns {Promise<{settings: Array}>}
     */
    async setAdminSettings(values) {
        const res = await fetch(`${BASE_URL}/admin/settings`, {
            method: 'PUT',
            headers: buildHeaders(),
            body: JSON.stringify({ values }),
        });
        return handleResponse(res);
    },

    /**
     * GET /admin/catalog — Référentiels administrables (MNO-17)
     * La console construit ses onglets et ses colonnes à partir de cette
     * description : elle n'énumère aucun référentiel.
     * @returns {Promise<{catalogs: Array<{key, label, hint, key_columns, fields}>}>}
     */
    async getAdminCatalog() {
        const res = await fetch(`${BASE_URL}/admin/catalog`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * GET /admin/catalog/:key — Entrées d'un référentiel, inactives comprises [admin]
     * @param {string} key - Identifiant du référentiel, ex. « categories »
     * @returns {Promise<{key, label, fields, entries: Array<Object>}>}
     */
    async getAdminCatalogEntries(key) {
        const res = await fetch(`${BASE_URL}/admin/catalog/${encodeURIComponent(key)}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * PATCH /admin/catalog/:key/:entryKey — Modifie les champs d'une entrée [admin]
     * @param {string} key - Identifiant du référentiel
     * @param {string} entryKey - Clé de l'entrée (« slug » ou « option/zone »)
     * @param {Object} values - Champs à modifier, par nom de colonne
     * @returns {Promise<Object>} L'entrée telle qu'enregistrée
     */
    async updateAdminCatalogEntry(key, entryKey, values) {
        const path = String(entryKey).split('/').map(encodeURIComponent).join('/');
        const res = await fetch(`${BASE_URL}/admin/catalog/${encodeURIComponent(key)}/${path}`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify({ values }),
        });
        return handleResponse(res);
    },

    /**
     * GET /admin/campaigns — Campagnes de notification et leur avancement [admin]
     * Le vocabulaire accepté (canaux, modes d'audience) vient du serveur : la
     * console n'énumère aucune valeur en dur (MNO-18).
     * @returns {Promise<{campaigns: Array<Object>, options: {channels: string[], audience_modes: string[]}}>}
     */
    async getAdminCampaigns() {
        const res = await fetch(`${BASE_URL}/admin/campaigns`, { headers: buildHeaders() });
        return handleResponse(res);
    },

    /**
     * POST /admin/campaigns/preview — Comptes visés et comptes joignables [admin]
     * N'écrit rien : sert à constater le poids d'une audience avant validation,
     * et à poser la photo figée au moment de la validation (MNO-18c).
     * @param {{audience_mode: string, user_ids?: string[]}} audience
     * @returns {Promise<{audience_mode: string, users: number, reachable: number}>}
     */
    async previewAdminCampaign(audience) {
        const res = await fetch(`${BASE_URL}/admin/campaigns/preview`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(audience),
        });
        return handleResponse(res);
    },

    /**
     * POST /admin/campaigns — Valide une campagne de notification [admin]
     * @param {Object} campaign - title, body, channel, audience_mode, user_ids, scheduled_at
     * @returns {Promise<Object>} La campagne telle qu'enregistrée (état réel)
     */
    async createAdminCampaign(campaign) {
        const res = await fetch(`${BASE_URL}/admin/campaigns`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(campaign),
        });
        return handleResponse(res);
    },

    /**
     * POST /admin/campaigns/:id/cancel — Annule une campagne avant son départ [admin]
     * @param {string} campaignId
     * @returns {Promise<Object>} La campagne annulée
     */
    async cancelAdminCampaign(campaignId) {
        const res = await fetch(`${BASE_URL}/admin/campaigns/${encodeURIComponent(campaignId)}/cancel`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    // ── Suivi et gestion des comptes (MNO-19) ────────────────────

    /**
     * GET /admin/users/directory — Liste filtrée et paginée des comptes [admin]
     * Répond aux questions d'ensemble (« qui a installé l'application », « qui
     * est bloqué ») là où `searchAdminUsers` ne retrouve qu'un compte connu.
     * Les filtres vides ne sont pas transmis : ils ne veulent rien dire (MNO-19).
     * @param {{q?: string, device?: string, blocked?: boolean, admin?: boolean, page?: number, per_page?: number}} filters
     * @returns {Promise<{users: Array<Object>, total: number, page: number, per_page: number, pages: number}>}
     */
    async getAdminUsersDirectory(filters = {}) {
        const params = new URLSearchParams();
        if (filters.q) params.set('q', String(filters.q).trim());
        if (filters.device) params.set('device', filters.device);
        if (filters.blocked !== undefined && filters.blocked !== null) {
            params.set('blocked', String(filters.blocked));
        }
        if (filters.admin !== undefined && filters.admin !== null) {
            params.set('admin', String(filters.admin));
        }
        if (filters.page) params.set('page', String(filters.page));
        if (filters.per_page) params.set('per_page', String(filters.per_page));
        const res = await fetch(`${BASE_URL}/admin/users/directory?${params}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /admin/users/:id/block — Bloque un compte, avec motif [admin]
     * Le blocage est relu à chaque requête : la session ouverte du compte est
     * refusée en 403 dès l'appel suivant (MNO-19a).
     * @param {string} userId
     * @param {string} [reason] - Motif saisi par l'exploitation
     * @returns {Promise<Object>} Le compte bloqué
     */
    async blockAdminUser(userId, reason = null) {
        const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/block`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ reason: reason || null }),
        });
        return handleResponse(res);
    },

    /**
     * POST /admin/users/:id/unblock — Lève le blocage d'un compte [admin]
     * Le motif et l'horodatage sont effacés : une sanction levée ne s'affiche plus.
     * @param {string} userId
     * @returns {Promise<Object>} Le compte rouvert
     */
    async unblockAdminUser(userId) {
        const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/unblock`, {
            method: 'POST',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    // ── Push Notifications (FCM) ─────────────────────────────────

    /**
     * POST /push/register — Enregistre le token FCM de l'appareil
     * @param {string} token
     * @param {string} platform - 'web', 'android', 'ios'
     * @param {boolean} resetOnly - Appareil déconnecté : ne reçoit plus que les
     *   liens de réinitialisation du mot de passe
     */
    async registerDeviceToken(token, platform = 'web', resetOnly = false) {
        const res = await fetch(`${BASE_URL}/push/register`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ token, platform, reset_only: resetOnly }),
        });
        return handleResponse(res);
    },

    /**
     * DELETE /push/register — Supprime le token FCM
     * @param {string} token 
     */
    async deleteDeviceToken(token) {
        const res = await fetch(`${BASE_URL}/push/register`, {
            method: 'DELETE',
            headers: buildHeaders(),
            body: JSON.stringify({ token }),
        });
        return handleResponse(res);
    },

    // ── Notifications ────────────────────────────────────────────

    /**
     * GET /notifications — Liste paginée des notifications de l'utilisateur [auth]
     * @param {number} [limit=10] — Nombre de notifications à retourner
     * @param {number} [offset=0] — Décalage pour la pagination
     * @returns {Promise<{ items: Array<{id, type, body, is_read, created_at, ...}>, total: number }>}
     */
    async getNotifications(limit = 10, offset = 0) {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        const res = await fetch(`${BASE_URL}/notifications?${params}`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * PUT /notifications/read-all — Marquer toutes les notifs comme lues [auth]
     */
    async markAllNotificationsRead() {
        const res = await fetch(`${BASE_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * PATCH /notifications/:id/read — Marquer une notif individuelle comme lue [auth]
     */
    async markNotificationRead(notifId) {
        const res = await fetch(`${BASE_URL}/notifications/${notifId}/read`, {
            method: 'PATCH',
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * POST /notifications/:id/open — Journalise l'ouverture d'une notif push [auth]
     * Appel fire-and-forget recommandé pour ne pas bloquer la navigation.
     */
    async trackNotificationOpen(notifId) {
        await fetch(`${BASE_URL}/notifications/${notifId}/open`, {
            method: 'POST',
            headers: buildHeaders(),
        });
    },

    /**
     * GET /notifications/unread-count — Nombre de notifications non lues [auth]
     * @returns {Promise<number>}
     */
    async getNotificationCount() {
        const res = await fetch(`${BASE_URL}/notifications/unread-count`, {
            headers: buildHeaders(),
        });
        const data = await handleResponse(res);
        return data?.count ?? data?.unread_count ?? 0;
    },

    /**
     * GET /notifications/preferences — Catégories de notification et leur état [auth]
     * @returns {Promise<{ categories: Array<{slug, label, description, enabled}> }>}
     */
    async getNotificationPreferences() {
        const res = await fetch(`${BASE_URL}/notifications/preferences`, {
            headers: buildHeaders(),
        });
        return handleResponse(res);
    },

    /**
     * PATCH /notifications/preferences — Enregistre un ou plusieurs choix de catégorie [auth]
     * @param {Record<string, boolean>} categories — slug → activé
     * @returns {Promise<{ categories: Array<{slug, label, description, enabled}> }>}
     */
    async updateNotificationPreferences(categories) {
        const res = await fetch(`${BASE_URL}/notifications/preferences`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify({ categories }),
        });
        return handleResponse(res);
    },

    // ── Upload S3 ───────────────────────────────────────────────

    /**
     * POST /upload/presigned-url — Obtient une URL temporaire S3
     * @param {string} filename - Le nom du fichier avec son extension
     * @param {string} contentType - Le type MIME (ex: image/jpeg)
     */
    async getPresignedUrl(filename, contentType) {
        const res = await fetch(`${BASE_URL}/upload/presigned-url`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ filename, content_type: contentType })
        });
        return handleResponse(res);
    },

    /**
     * Notifie l'API qu'un fichier a été uploadé sur S3 (enqueue le job de conversion thumb/medium).
     * @param {string} fileUrl - URL publique du fichier (ex. retournée par uploadToS3)
     */
    async notifyImageUploaded(fileUrl) {
        const res = await fetch(`${BASE_URL}/upload/notify`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ file_url: fileUrl })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Notify failed ${res.status}`);
        }
        return res.json();
    },

    /**
     * Uploade directement un fichier vers S3 et retourne l'URL publique.
     * Après upload, notifie l'API pour enqueue le traitement asynchrone (thumb + medium).
     */
    async uploadToS3(file) {
        const presignedData = await this.getPresignedUrl(file.name, file.type);

        const uploadRes = await fetch(presignedData.upload_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error('S3 Upload Error Response:', errorText);
            throw new Error(`S3 Error ${uploadRes.status}: ${errorText || 'Unknown error'}`);
        }

        try {
            await this.notifyImageUploaded(presignedData.file_url);
        } catch (e) {
            console.warn('Upload notify failed (image will show as original until worker runs):', e);
        }

        return presignedData.file_url;
    }
};
