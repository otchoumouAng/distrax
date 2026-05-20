/**
 * Échappe les caractères HTML pour affichage sûr dans du texte.
 * À utiliser pour tout contenu utilisateur avant insertion dans innerHTML.
 */
export function escapeHtml(str) {
    if (str == null || typeof str !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (c) => map[c]);
}

/** Retourne l'URL si elle est http(s), sinon chaîne vide (évite javascript:, data:, etc.). */
export function safeUrl(url) {
    if (url == null || typeof url !== 'string') return '';
    const t = url.trim();
    if (t.startsWith('https://') || t.startsWith('http://')) return t;
    return '';
}

/** Chemin de l’image de profil par défaut (silhouette) quand l’utilisateur n’a pas de photo. */
export const DEFAULT_AVATAR_PATH = '/assets/img/avatar.svg';

/** Data URI pour avatar par défaut (même silhouette) en fallback si l’asset ne charge pas. */
export const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#9ca3af" stroke-width="1.5"><circle cx="32" cy="20" r="10"/><path d="M12 58c0-11 8.954-20 20-20s20 9 20 20"/></svg>'
);
