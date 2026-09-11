import { describe, expect, it } from 'vitest';

import { formatSpotsLabel, isValidSpotsSelection } from './formatSpots.js';

describe('formatSpotsLabel', () => {
    it('affiche explicitement une envie illimitée', () => {
        expect(formatSpotsLabel(42, 100, true)).toBe('Places illimitées');
    });

    it('affiche le compteur pour une envie limitée', () => {
        expect(formatSpotsLabel(3, 10, false)).toBe('3 / 10 places');
    });

    it('affiche complet uniquement pour une envie limitée pleine', () => {
        expect(formatSpotsLabel(10, 10, false)).toBe('Complet');
        expect(formatSpotsLabel(100, 100, true)).toBe('Places illimitées');
    });
});

describe('isValidSpotsSelection', () => {
    it('refuse un formulaire sans choix de capacité', () => {
        expect(isValidSpotsSelection(false, false, '')).toBe(false);
    });

    it('accepte le mode illimité sans nombre', () => {
        expect(isValidSpotsSelection(true, false, '')).toBe(true);
    });

    it('exige un entier compris entre 1 et 100 en mode limité', () => {
        expect(isValidSpotsSelection(false, true, 10)).toBe(true);
        expect(isValidSpotsSelection(false, true, 0)).toBe(false);
        expect(isValidSpotsSelection(false, true, 101)).toBe(false);
        expect(isValidSpotsSelection(false, true, 1.5)).toBe(false);
    });
});
