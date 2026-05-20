/**
 * Utilitaires pour les URLs d'images renvoyées par l'API.
 * En dev : les chemins relatifs (ex. /uploads/xxx) sont servis via le proxy Vite vers le backend.
 * Convention variantes S3+Lambda : originals/ → thumb/ ou medium/ en .webp
 */

/**
 * Retourne une URL utilisable pour une image (avatar, photo d'envie, etc.).
 * - Si l'URL est absolue (http/https), elle est retournée telle quelle.
 * - Si l'URL est relative (commence par /), elle est retournée telle quelle (le navigateur
 *   la résout vers l'origine ; en dev le proxy Vite peut faire suivre /uploads vers le backend).
 * - Sinon (chaîne vide, javascript:, etc.) retourne ''.
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function resolveImageUrl(url) {
    if (url == null || typeof url !== 'string') return '';
    const t = url.trim();
    if (!t) return '';
    if (t.startsWith('https://') || t.startsWith('http://')) return t;
    if (t.startsWith('/')) return t;
    return '';
}

/**
 * Retourne l'URL d'une variante d'image (thumb, medium, full) pour les originaux S3 sous originals/.
 * Si l'URL ne contient pas originals/, retourne l'URL telle quelle (rétrocompatibilité).
 * @param {string} canonicalUrl - URL canonique (original) renvoyée par l'API
 * @param {'thumb'|'medium'|'full'} variant
 * @returns {string}
 */
export function getImageVariantUrl(canonicalUrl, variant) {
    const url = resolveImageUrl(canonicalUrl);
    if (!url) return '';
    if (variant === 'full') return url;
    if (!url.includes('originals/')) return url;
    // .../originals/2025/uuid.jpg → .../thumb/2025/uuid.webp ou .../medium/2025/uuid.webp
    const prefix = variant === 'thumb' ? 'thumb' : 'medium';
    return url.replace('originals/', prefix + '/').replace(/\.[a-zA-Z0-9]+$/i, '.webp');
}

/**
 * Pour les listes d'URLs (ex. images d'une envie), filtre et résout chaque URL.
 * @param {string[]|string|null} urls - Tableau d'URLs ou chaîne comma-separée
 * @returns {string[]}
 */
export function resolveImageUrls(urls) {
    if (!urls) return [];
    const arr = Array.isArray(urls) ? urls : String(urls).split(',').map(s => s.trim()).filter(Boolean);
    return arr.map(resolveImageUrl).filter(Boolean);
}
