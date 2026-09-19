import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildLikeButtonHtml,
    createLikeController,
    handleLikeButtonClick,
    isLikeDisabled,
    isTruthyAttribute,
    nextLikeState,
    parseLikeCount,
    resolveLikeResponse,
} from './desireLikes.js';

describe('isLikeDisabled — désactivation du like', () => {
    it('désactive le like en mode « past »', () => {
        expect(isLikeDisabled({ mode: 'past' })).toBe(true);
    });

    it('désactive le like pour les statuts terminaux (CAT-04)', () => {
        ['cancelled', 'archived', 'realized', 'not_realized'].forEach((status) => {
            expect(isLikeDisabled({ mode: 'default', status })).toBe(true);
        });
    });

    it('laisse le like actif pour une envie publiée', () => {
        expect(isLikeDisabled({ mode: 'default', status: 'published' })).toBe(false);
        expect(isLikeDisabled({ mode: 'explore', status: '' })).toBe(false);
    });
});

describe('parseLikeCount / isTruthyAttribute — normalisation', () => {
    it('normalise un compteur de likes', () => {
        expect(parseLikeCount(7)).toBe(7);
        expect(parseLikeCount('12')).toBe(12);
        expect(parseLikeCount(null)).toBe(0);
        expect(parseLikeCount(-3)).toBe(0);
        expect(parseLikeCount('abc')).toBe(0);
    });

    it('interprète l’attribut booléen « liked »', () => {
        expect(isTruthyAttribute('')).toBe(true);
        expect(isTruthyAttribute('true')).toBe(true);
        expect(isTruthyAttribute(null)).toBe(false);
        expect(isTruthyAttribute('false')).toBe(false);
        expect(isTruthyAttribute('0')).toBe(false);
    });
});

describe('nextLikeState / resolveLikeResponse', () => {
    it('bascule le compteur dans le sens du changement', () => {
        expect(nextLikeState({ liked: false, likeCount: 4 })).toEqual({ liked: true, likeCount: 5 });
        expect(nextLikeState({ liked: true, likeCount: 4 })).toEqual({ liked: false, likeCount: 3 });
    });

    it('ne descend jamais sous zéro', () => {
        expect(nextLikeState({ liked: true, likeCount: 0 })).toEqual({ liked: false, likeCount: 0 });
    });

    it('réconcilie avec la réponse du serveur', () => {
        expect(resolveLikeResponse({ liked: true, like_count: 42 }, { liked: true, likeCount: 5 }))
            .toEqual({ liked: true, likeCount: 42 });
        // Réponse incomplète : on garde l'état optimiste.
        expect(resolveLikeResponse({}, { liked: true, likeCount: 5 }))
            .toEqual({ liked: true, likeCount: 5 });
    });
});

describe('buildLikeButtonHtml — rendu du bouton ♥', () => {
    it('rend un cœur vide à l’état neutre', () => {
        const html = buildLikeButtonHtml({ liked: false, likeCount: 0 });
        expect(html).toContain('class="like-btn"');
        expect(html).toContain('>favorite_border</i>');
        expect(html).toContain('aria-pressed="false"');
        expect(html).not.toContain('is-active');
    });

    it('rend un cœur plein avec le compteur à l’état aimé', () => {
        const html = buildLikeButtonHtml({ liked: true, likeCount: 7 });
        expect(html).toContain('like-btn is-active');
        expect(html).toContain('>favorite</i>');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('>7</span>');
        expect(html).toContain('Retirer mon like');
    });

    it('rend un bouton désactivé (activité passée)', () => {
        const html = buildLikeButtonHtml({ liked: false, likeCount: 2, disabled: true });
        expect(html).toContain('disabled');
    });
});

describe('handleLikeButtonClick — pas de navigation au clic', () => {
    it('stoppe la propagation puis bascule le like', () => {
        const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
        const controller = { toggle: vi.fn().mockResolvedValue({ ok: true }) };

        handleLikeButtonClick(event, controller);

        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(controller.toggle).toHaveBeenCalledTimes(1);
    });
});

describe('createLikeController — bascule optimiste, réconciliation et rollback', () => {
    let state;
    let writes;
    let onChange;
    let onError;
    let api;
    let controller;

    const mount = (initial) => {
        state = { ...initial };
        writes = [];
        onChange = vi.fn();
        onError = vi.fn();
        controller = createLikeController({
            readState: () => ({ ...state }),
            writeState: (next) => {
                writes.push(next);
                state = { desireId: initial.desireId, ...next };
            },
            onChange,
            onError,
            loadApi: async () => api,
        });
    };

    beforeEach(() => {
        api = {
            likeDesire: vi.fn().mockResolvedValue({ liked: true, like_count: 12 }),
            unlikeDesire: vi.fn().mockResolvedValue({ liked: false, like_count: 11 }),
        };
    });

    it('applique la bascule optimiste puis réconcilie avec le serveur (like)', async () => {
        mount({ desireId: 'd1', liked: false, likeCount: 4 });

        const result = await controller.toggle();

        expect(api.likeDesire).toHaveBeenCalledWith('d1');
        expect(api.unlikeDesire).not.toHaveBeenCalled();
        // Retour visuel immédiat avant la réponse réseau.
        expect(writes[0]).toEqual({ liked: true, likeCount: 5 });
        // Puis état réconcilié par le compteur serveur.
        expect(writes[writes.length - 1]).toEqual({ liked: true, likeCount: 12 });
        expect(onChange).toHaveBeenCalledWith({ liked: true, likeCount: 12 });
        expect(onError).not.toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(controller.isPending()).toBe(false);
    });

    it('appelle l’API de retrait quand l’envie est déjà aimée', async () => {
        mount({ desireId: 'd1', liked: true, likeCount: 12 });

        await controller.toggle();

        expect(api.unlikeDesire).toHaveBeenCalledWith('d1');
        expect(api.likeDesire).not.toHaveBeenCalled();
        expect(writes[writes.length - 1]).toEqual({ liked: false, likeCount: 11 });
    });

    it('restaure l’état précédent en cas d’échec réseau', async () => {
        api.likeDesire.mockRejectedValue(new Error('réseau indisponible'));
        mount({ desireId: 'd1', liked: false, likeCount: 4 });

        const result = await controller.toggle();

        expect(result.ok).toBe(false);
        expect(writes[writes.length - 1]).toMatchObject({ liked: false, likeCount: 4 });
        expect(onChange).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('ignore un second clic tant que la requête est en cours', async () => {
        let release;
        api.likeDesire.mockReturnValue(new Promise((resolve) => { release = resolve; }));
        mount({ desireId: 'd1', liked: false, likeCount: 4 });

        const first = controller.toggle();
        const second = await controller.toggle();

        expect(second.skipped).toBe(true);
        expect(api.likeDesire).toHaveBeenCalledTimes(1);

        release({ liked: true, like_count: 5 });
        await first;
    });

    it('ne fait rien si l’identifiant de l’envie est absent', async () => {
        mount({ desireId: null, liked: false, likeCount: 0 });

        const result = await controller.toggle();

        expect(result.skipped).toBe(true);
        expect(api.likeDesire).not.toHaveBeenCalled();
        expect(writes).toHaveLength(0);
    });
});
