import { describe, expect, it } from 'vitest';

import {
    identifierError,
    isValidEmail,
    isValidIdentifier,
    isValidPhone,
    looksLikeEmail,
} from './identifier.js';

describe('identifier', () => {
    it('reconnaît une adresse email à la présence de « @ »', () => {
        expect(looksLikeEmail('awa@example.com')).toBe(true);
        expect(looksLikeEmail('+2250102030405')).toBe(false);
    });

    it('accepte un numéro de téléphone valide', () => {
        expect(isValidPhone('+2250102030405')).toBe(true);
        expect(isValidPhone('0102030405')).toBe(true);
        expect(isValidPhone('+22501')).toBe(false);
        expect(isValidPhone('telephone')).toBe(false);
    });

    it('accepte une adresse email valide', () => {
        expect(isValidEmail('awa@example.com')).toBe(true);
        expect(isValidEmail('adresse-invalide')).toBe(false);
        expect(isValidEmail('awa@example')).toBe(false);
    });

    it('accepte l’un ou l’autre comme identifiant', () => {
        expect(isValidIdentifier('+2250102030405')).toBe(true);
        expect(isValidIdentifier('awa@example.com')).toBe(true);
        expect(isValidIdentifier('pas-un-identifiant')).toBe(false);
    });

    it('tolère les espaces autour de la saisie', () => {
        expect(isValidIdentifier('  awa@example.com  ')).toBe(true);
    });

    it('explique ce qui manque quand la saisie est vide', () => {
        expect(identifierError('')).toMatch(/numéro de téléphone ou votre adresse email/);
        expect(identifierError('   ')).not.toBeNull();
    });

    it('signale une saisie qui n’est ni un téléphone ni un email', () => {
        expect(identifierError('pas-un-identifiant')).toMatch(/valide/);
    });

    it('ne renvoie aucune erreur pour un identifiant exploitable', () => {
        expect(identifierError('+2250102030405')).toBeNull();
        expect(identifierError('awa@example.com')).toBeNull();
    });
});
