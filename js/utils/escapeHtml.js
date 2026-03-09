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
