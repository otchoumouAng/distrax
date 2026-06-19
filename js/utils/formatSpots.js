/**
 * Libellé places pour les cartes d'envie.
 * @param {number} spotsTaken
 * @param {number} maxSpots
 * @returns {string}
 */
export function formatSpotsLabel(spotsTaken, maxSpots) {
    const taken = Number(spotsTaken) || 0;
    const max = Number(maxSpots) || 0;
    if (max > 0 && taken >= max) return 'Complet';
    if (max > 0) return `${taken} / ${max} places`;
    // Fallback si pas de max (rétrocompatibilité)
    return taken <= 1 ? `${taken} personne intéressée` : `${taken} personnes intéressées`;
}
