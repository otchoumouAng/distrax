/** Construit les filtres du fil général sans exclure de catégorie implicitement. */
export function buildExplorationFilters(activeFilters = {}, activeCategory = null, page = 1, size = 10) {
    const filters = { ...activeFilters };
    if (activeCategory) filters.category = activeCategory;
    filters.page = page;
    filters.size = size;
    return filters;
}
