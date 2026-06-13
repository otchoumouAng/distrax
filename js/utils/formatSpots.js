/**
 * Libellé places + personnes intéressées pour les cartes d'envie.
 * @param {number} spotsTaken
 * @param {number} maxSpots
 * @returns {string}
 */
export function formatSpotsLabel(spotsTaken, maxSpots) {
    const taken = Number(spotsTaken) || 0;
    const interested =
        taken <= 1
            ? `${taken} personne intéressée`
            : `${taken} personnes intéressées`;
    return interested;
}
