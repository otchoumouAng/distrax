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

function getToken() {
    return localStorage.getItem('dystrax-token');
}

function setToken(token) {
    localStorage.setItem('dystrax-token', token);
}

function removeToken() {
    localStorage.removeItem('dystrax-token');
    localStorage.removeItem('dystrax-user');
}

function isAuthenticated() {
    return !!getToken();
}

function buildHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
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
            headers: buildHeaders(),
            body: JSON.stringify({ pseudo, phone, password }),
        });
        return handleResponse(res);
    },

    /**
     * Connexion : POST /auth/login (OAuth2PasswordRequestForm)
     * Stocke le JWT en localStorage après succès.
     * @returns {Promise<{access_token, token_type}>}
     */
    async login(phone, password) {
        // Encodage explicite pour éviter tout problème avec @, &, +, etc. dans le mot de passe
        const body = `username=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`;
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data = await handleResponse(res);
        setToken(data.access_token);
        return data;
    },

    /** Déconnexion : supprime le token du localStorage */
    logout() {
        removeToken();
    },

    isAuthenticated,

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
     * @param {Object} filters - { query, category, commune, price_type, page, size }
     */
    async fetchDesires(filters = {}) {
        const params = new URLSearchParams();
        if (filters.query) params.set('query', filters.query);
        if (filters.category) params.set('category', filters.category);
        if (filters.commune) params.set('commune', filters.commune);
        if (filters.price_type) params.set('price_type', filters.price_type);
        params.set('page', filters.page || 1);
        params.set('size', filters.size || 20);

        const res = await fetch(`${BASE_URL}/desires?${params}`, {
            headers: buildHeaders(),
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

    // ── Notifications ────────────────────────────────────────────

    /**
     * GET /notifications — Liste des notifications de l'utilisateur [auth]
     * @returns {Promise<Array<{id, type, body, is_read, created_at, data}>>}
     */
    async getNotifications() {
        const res = await fetch(`${BASE_URL}/notifications`, {
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
     * Uploade directement un fichier vers S3 et retourne l'URL publique
     * @param {File} file - Fichier à uploader
     */
    async uploadToS3(file) {
        // Demande de l'URL d'upload
        const presignedData = await this.getPresignedUrl(file.name, file.type);

        // Upload direct vers AWS S3
        const uploadRes = await fetch(presignedData.upload_url, {
            method: 'PUT',
            body: file,
            headers: {
                // Must explicitly set Content-Type if we sent it in the presigned URL request!
                'Content-Type': file.type
            }
        });

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error('S3 Upload Error Response:', errorText);
            throw new Error(`S3 Error ${uploadRes.status}: ${errorText || 'Unknown error'}`);
        }

        // Renvoie l'URL de lecture du fichier
        return presignedData.file_url;
    }
};
