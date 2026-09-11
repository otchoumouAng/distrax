import { describe, expect, it } from 'vitest';

import { buildExplorationFilters } from './desireFilters.js';

describe('buildExplorationFilters', () => {
    it('n’exclut pas Rencontres du fil général', () => {
        const filters = buildExplorationFilters({}, null, 1, 10);
        expect(filters).not.toHaveProperty('exclude_category');
        expect(filters).not.toHaveProperty('category');
    });

    it('conserve le filtre Rencontres lorsqu’il est choisi explicitement', () => {
        expect(buildExplorationFilters({}, 'rencontres', 2, 10)).toEqual({
            category: 'rencontres',
            page: 2,
            size: 10,
        });
    });

    it('transmet le filtre temporel au backend (CAT-03)', () => {
        expect(buildExplorationFilters({ date: 'weekend' }, null, 1, 10)).toEqual({
            date: 'weekend',
            page: 1,
            size: 10,
        });
    });
});
