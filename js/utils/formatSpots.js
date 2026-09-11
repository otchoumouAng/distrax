/**
 * Libellé places pour les cartes d'envie.
 * @param {number} spotsTaken
 * @param {number} maxSpots
 * @param {boolean} isUnlimited
 * @returns {string}
 */
export function formatSpotsLabel(spotsTaken, maxSpots, isUnlimited = false) {
    if (isUnlimited) return 'Places illimitées';
    const taken = Number(spotsTaken) || 0;
    const max = Number(maxSpots) || 0;
    if (max > 0 && taken >= max) return 'Complet';
    if (max > 0) return `${taken} / ${max} places`;
    // Fallback si pas de max (rétrocompatibilité)
    return taken <= 1 ? `${taken} personne intéressée` : `${taken} personnes intéressées`;
}

/**
 * Valide le choix de capacité du formulaire de création.
 * Un seul mode doit être sélectionné et le mode limité exige un entier de 1 à 100.
 */
export function isValidSpotsSelection(isUnlimited, isLimited, maxSpots) {
    if (Boolean(isUnlimited) === Boolean(isLimited)) return false;
    if (isUnlimited) return true;
    const value = Number(maxSpots);
    return Number.isInteger(value) && value >= 1 && value <= 100;
}
