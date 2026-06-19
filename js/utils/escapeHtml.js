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

/** Data URI pour avatar par défaut : icône Material "person" sur fond cercle gris. */
export const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#e5e7eb"/><path d="M32 34c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6zm0 3c-4 0-12 2-12 6v3h24v-3c0-4-8-6-12-6z" fill="#9ca3af"/></svg>'
);

/** Alias rétrocompatible — même data URI inline (plus de fichier avatar.svg). */
export const DEFAULT_AVATAR_PATH = DEFAULT_AVATAR_DATA_URI;
