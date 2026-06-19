/**
 * Cache des icônes de catégories (slug → Material icon name).
 * Chargé une seule fois depuis l'API.
 */

let _icons = null; // Map<string, string> | null

/** Charge les icônes depuis l'API et les met en cache. */
async function _ensureLoaded() {
    if (_icons) return;
    _icons = new Map();
    try {
        const { api } = await import('../api.js');
        const items = await api.getCategoriesFull();
        if (Array.isArray(items)) {
            items.forEach(c => {
                if (c.slug && c.icon) _icons.set(c.slug, c.icon);
            });
        }
    } catch (e) {
        console.warn('[categoryIcons] Chargement échoué:', e.message);
    }
}

/**
 * Retourne le nom d'icône Material pour un slug de catégorie.
 * @param {string} slug
 * @returns {Promise<string>}
 */
export async function getCategoryIcon(slug) {
    await _ensureLoaded();
    return _icons.get(slug) || slug;
}
