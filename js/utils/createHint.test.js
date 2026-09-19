import { describe, expect, it } from 'vitest';

import {
    CREATE_HINT_DISMISS_KEY,
    dismissCreateHint,
    isCreateHintDismissed,
    shouldShowCreateHint,
} from './createHint.js';

function createFakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); },
    };
}

describe('createHint', () => {
    it("s'affiche tant que rien n'a été mémorisé", () => {
        const storage = createFakeStorage();
        expect(shouldShowCreateHint(storage)).toBe(true);
        expect(isCreateHintDismissed(storage)).toBe(false);
    });

    it('ne s\'affiche plus une fois mémorisée', () => {
        const storage = createFakeStorage();
        dismissCreateHint(storage);
        expect(shouldShowCreateHint(storage)).toBe(false);
        expect(isCreateHintDismissed(storage)).toBe(true);
        expect(storage.data[CREATE_HINT_DISMISS_KEY]).toBe('1');
    });

    it('reconnaît un état déjà mémorisé au chargement', () => {
        const storage = createFakeStorage({ [CREATE_HINT_DISMISS_KEY]: '1' });
        expect(shouldShowCreateHint(storage)).toBe(false);
    });

    it('ignore une valeur différente de "1"', () => {
        const storage = createFakeStorage({ [CREATE_HINT_DISMISS_KEY]: '0' });
        expect(shouldShowCreateHint(storage)).toBe(true);
    });

    it('reste silencieux si le stockage est absent', () => {
        expect(shouldShowCreateHint(null)).toBe(true);
        expect(isCreateHintDismissed(null)).toBe(false);
        expect(() => dismissCreateHint(null)).not.toThrow();
    });

    it('résiste à un stockage qui lève une exception', () => {
        const storage = {
            getItem: () => { throw new Error('interdit'); },
            setItem: () => { throw new Error('quota'); },
        };
        expect(shouldShowCreateHint(storage)).toBe(true);
        expect(() => dismissCreateHint(storage)).not.toThrow();
    });
});
