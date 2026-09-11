import { beforeAll, describe, expect, it, vi } from 'vitest';

let getDesireStatusBadge;

beforeAll(async () => {
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define: vi.fn() };

    ({ getDesireStatusBadge } = await import('./DesireCard.js'));
});

describe('getDesireStatusBadge (CAT-04)', () => {
    it('affiche un libellé clair pour chaque statut terminal', () => {
        expect(getDesireStatusBadge('cancelled').label).toBe('Annulée');
        expect(getDesireStatusBadge('realized').label).toBe('Réalisée');
        expect(getDesireStatusBadge('expired').label).toBe('Expirée');
        expect(getDesireStatusBadge('not_realized').label).toBe('Non réalisée');
        expect(getDesireStatusBadge('archived').label).toBe('Archivée');
        expect(getDesireStatusBadge('draft').label).toBe('Brouillon');
    });

    it('n’affiche aucun badge pour une envie publiée ou un statut inconnu', () => {
        expect(getDesireStatusBadge('published')).toBeNull();
        expect(getDesireStatusBadge('')).toBeNull();
        expect(getDesireStatusBadge(null)).toBeNull();
        expect(getDesireStatusBadge('inconnu')).toBeNull();
    });
});
