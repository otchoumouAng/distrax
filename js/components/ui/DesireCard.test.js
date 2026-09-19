import { beforeAll, describe, expect, it, vi } from 'vitest';

let getDesireStatusBadge;
let DesireCard;

beforeAll(async () => {
    globalThis.HTMLElement = class {};
    globalThis.customElements = { define: vi.fn() };
    // Environnement de test « node » : pas de CustomEvent natif.
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
            this.bubbles = options.bubbles;
            this.composed = options.composed;
        }
    };

    ({ getDesireStatusBadge, DesireCard } = await import('./DesireCard.js'));
});

/** Bouton ♥ factice pour tester le rafraîchissement ciblé sans DOM. */
const makeLikeButton = () => {
    const classes = new Set();
    const attrs = {};
    const icon = { textContent: '' };
    const counter = { textContent: '' };
    return {
        disabled: false,
        classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } },
        setAttribute: (name, value) => { attrs[name] = value; },
        querySelector: (selector) => (selector === '.material-icons-round' ? icon : counter),
        classes,
        attrs,
        icon,
        counter,
    };
};

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

describe('DesireCard — bouton like ♥', () => {
    const buildCard = (attributes) => {
        const card = Object.create(DesireCard.prototype);
        card.getAttribute = (name) => (name in attributes ? attributes[name] : null);
        return card;
    };

    it('émet « desire-like-changed » avec l’identifiant, l’état et le compteur', () => {
        const card = buildCard({ 'desire-id': 'd42', liked: '', 'like-count': '9' });
        card.dispatchEvent = vi.fn();

        card._emitLikeChanged({ liked: true, likeCount: 9 });

        expect(card.dispatchEvent).toHaveBeenCalledTimes(1);
        const event = card.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('desire-like-changed');
        expect(event.detail).toEqual({ desireId: 'd42', liked: true, likeCount: 9 });
        expect(event.bubbles).toBe(true);
        expect(event.composed).toBe(true);
    });

    it('désactive le bouton quand la carte est en mode « past »', () => {
        const card = buildCard({ mode: 'past', liked: '', 'like-count': '3' });
        const btn = makeLikeButton();
        card.querySelector = () => btn;

        card._refreshLikeButton();

        expect(btn.disabled).toBe(true);
        expect(btn.icon.textContent).toBe('favorite');
        expect(btn.counter.textContent).toBe('3');
        expect(btn.attrs['aria-pressed']).toBe('true');
    });

    it('garde le bouton actif et neutre pour une envie publiée', () => {
        const card = buildCard({ mode: 'default', 'desire-status': 'published', 'like-count': '0' });
        const btn = makeLikeButton();
        card.querySelector = () => btn;

        card._refreshLikeButton();

        expect(btn.disabled).toBe(false);
        expect(btn.icon.textContent).toBe('favorite_border');
        expect(btn.classes.has('is-active')).toBe(false);
        expect(btn.attrs['aria-label']).toBe('Aimer cette envie');
    });
});
