/**
 * featureFlags.js — Utilitaire de vérification des fonctionnalités.
 *
 * Charge la liste des features depuis GET /api/v1/features une seule fois
 * (cache en mémoire pour la durée de la session), puis expose :
 *   - isFeatureEnabled(slug)   → async, garantit la réponse
 *   - syncIsEnabled(slug)      → synchrone si le cache est chaud, sinon `undefined`
 *   - preloadFeatureFlags()    → à appeler au démarrage de l'app
 *   - clearFeatureCache()      → pour forcer un rechargement
 */

/** @type {Record<string, boolean> | null} */
let _cache = null;
let _loadPromise = null;

/** Force un rechargement du cache (utile après modification admin) */
export function clearFeatureCache() {
    _cache = null;
    _loadPromise = null;
}

/**
 * Charge et met en cache les feature flags depuis l'API.
 * Protégé contre les appels concurrents (promise partagée).
 * @returns {Promise<Record<string, boolean>>}
 */
async function loadFlags() {
    if (_cache) return _cache;
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
        try {
            const { api } = await import('../api.js');
            const data = await api.getFeatures();
            _cache = {};
            (data?.features || []).forEach(f => {
                _cache[f.slug] = !!f.is_active;
            });
        } catch (e) {
            console.warn('[FeatureFlags] Impossible de charger les features:', e?.message);
            _cache = {}; // cache vide = toutes les features supposées actives
        }
        return _cache;
    })();
    return _loadPromise;
}

/**
 * Précharge les feature flags. À appeler le plus tôt possible (main.ts au démarrage).
 * @returns {Promise<void>}
 */
export async function preloadFeatureFlags() {
    await loadFlags();
}

/**
 * Vérifie si une fonctionnalité est active (async).
 * Si le slug est inconnu, retourne true par défaut (fail-open).
 *
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(slug) {
    const flags = await loadFlags();
    if (!(slug in flags)) return true;
    return flags[slug];
}

/**
 * Vérifie si une fonctionnalité est active (synchrone, nécessite cache chaud).
 * Retourne `undefined` si le cache n'est pas encore chargé.
 *
 * @param {string} slug
 * @returns {boolean | undefined}
 */
export function syncIsEnabled(slug) {
    if (_cache === null) return undefined;
    if (!(slug in _cache)) return true;
    return _cache[slug];
}
