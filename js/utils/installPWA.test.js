import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    canInstallPrompt,
    captureInstallPrompt,
    dismissInstall,
    isInstallDismissed,
    isInstallSupported,
    isIOS,
    isStandalone,
    offerInstallBanner,
    onInstallAvailabilityChange,
    triggerInstall,
} from './installPWA.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0';

function createFakeWindow() {
    const listeners = {};
    return {
        listeners,
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: false },
        addEventListener: (type, handler) => {
            (listeners[type] = listeners[type] || []).push(handler);
        },
        removeEventListener: (type, handler) => {
            listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
        },
        emit: (type, event) => (listeners[type] || []).forEach((handler) => handler(event)),
    };
}

function createFakeDocument() {
    const appended = [];
    return {
        appended,
        getElementById: () => null,
        createElement: () => ({ style: {}, querySelector: () => null }),
        body: { appendChild: (element) => appended.push(element) },
    };
}

beforeEach(async () => {
    // Réinitialise l'invite différée éventuellement mémorisée par un test précédent.
    try { if (canInstallPrompt()) await triggerInstall(); } catch { /* ignore */ }
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('isIOS', () => {
    it('reconnaît les iPhone et iPad d’après leur user agent', () => {
        expect(isIOS(IPHONE_UA, 'iPhone', 5)).toBe(true);
        expect(isIOS(IPAD_UA, 'iPad', 5)).toBe(true);
    });

    it('reconnaît l’iPad récent qui se présente comme un Mac tactile', () => {
        expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5)).toBe(true);
        expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 0)).toBe(false);
    });

    it('ignore les autres plateformes', () => {
        expect(isIOS(ANDROID_UA, 'Linux armv8l', 5)).toBe(false);
    });
});

describe('isStandalone', () => {
    it('détecte l’affichage autonome via display-mode', () => {
        const win = { matchMedia: () => ({ matches: true }), navigator: {} };
        expect(isStandalone(win)).toBe(true);
    });

    it('détecte l’application installée sur iOS via navigator.standalone', () => {
        const win = { matchMedia: () => ({ matches: false }), navigator: { standalone: true } };
        expect(isStandalone(win)).toBe(true);
    });

    it('retourne faux dans un navigateur classique', () => {
        const win = { matchMedia: () => ({ matches: false }), navigator: { standalone: false } };
        expect(isStandalone(win)).toBe(false);
    });
});

describe('captureInstallPrompt', () => {
    it('intercepte beforeinstallprompt et notifie les écouteurs', () => {
        const win = createFakeWindow();
        vi.stubGlobal('window', win);

        const onChange = vi.fn();
        const unsubscribe = onInstallAvailabilityChange(onChange);

        captureInstallPrompt();
        expect(canInstallPrompt()).toBe(false);

        const event = { preventDefault: vi.fn() };
        win.emit('beforeinstallprompt', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(canInstallPrompt()).toBe(true);
        expect(onChange).toHaveBeenCalled();

        unsubscribe();
    });

    it('nettoie l’invite quand l’application est installée', () => {
        const win = createFakeWindow();
        vi.stubGlobal('window', win);

        const remove = captureInstallPrompt();
        win.emit('beforeinstallprompt', { preventDefault: vi.fn() });
        expect(canInstallPrompt()).toBe(true);

        win.emit('appinstalled', {});
        expect(canInstallPrompt()).toBe(false);

        remove();
    });
});

describe('triggerInstall', () => {
    it('retourne vrai quand l’utilisateur accepte l’invite', async () => {
        const win = createFakeWindow();
        vi.stubGlobal('window', win);

        captureInstallPrompt();
        win.emit('beforeinstallprompt', {
            preventDefault: vi.fn(),
            prompt: vi.fn(),
            userChoice: Promise.resolve({ outcome: 'accepted' }),
        });

        await expect(triggerInstall()).resolves.toBe(true);
        expect(canInstallPrompt()).toBe(false);
    });

    it('retourne faux sans invite disponible', async () => {
        await expect(triggerInstall()).resolves.toBe(false);
    });
});

describe('mémorisation du report', () => {
    it('retient que l’utilisateur a écarté la proposition', () => {
        const store = {};
        vi.stubGlobal('localStorage', {
            getItem: (key) => (key in store ? store[key] : null),
            setItem: (key, value) => { store[key] = String(value); },
        });

        expect(isInstallDismissed()).toBe(false);
        dismissInstall();
        expect(isInstallDismissed()).toBe(true);
    });
});

describe('isInstallSupported', () => {
    it('est faux sans invite native ni iPhone', () => {
        vi.stubGlobal('navigator', { userAgent: ANDROID_UA, platform: 'Linux armv8l', maxTouchPoints: 5 });
        expect(isInstallSupported()).toBe(false);
    });

    it('est vrai sur iPhone même sans invite native', () => {
        vi.stubGlobal('navigator', { userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 });
        expect(isInstallSupported()).toBe(true);
    });
});

describe('offerInstallBanner', () => {
    it('ne fait rien sans DOM', () => {
        expect(offerInstallBanner('Installez Dystrax')).toBe(false);
    });

    it('n’affiche rien lorsque l’application est déjà installée', () => {
        const doc = createFakeDocument();
        vi.stubGlobal('document', doc);
        vi.stubGlobal('window', {
            matchMedia: () => ({ matches: true }),
            navigator: { standalone: false },
        });

        expect(offerInstallBanner('Installez Dystrax')).toBe(false);
        expect(doc.appended).toHaveLength(0);
    });

    it('affiche le guide d’installation sur iPhone', () => {
        const doc = createFakeDocument();
        vi.stubGlobal('document', doc);
        vi.stubGlobal('window', {
            matchMedia: () => ({ matches: false }),
            navigator: { standalone: false },
        });
        vi.stubGlobal('navigator', { userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 });

        expect(offerInstallBanner('Ajoutez Dystrax à votre écran d’accueil')).toBe(true);
        expect(doc.appended).toHaveLength(1);
        expect(doc.appended[0].id).toBe('pwa-install-banner');
        expect(doc.appended[0].innerHTML).toContain('Sur l');
    });
});
