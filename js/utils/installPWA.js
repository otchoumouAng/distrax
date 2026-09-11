// Installation de la PWA (PWA-01 → PWA-06)
// Détection de l'environnement, capture de `beforeinstallprompt`, guide iPhone
// et encart contextuel. Aucun service externe n'est sollicité.
import { escapeHtml } from './escapeHtml.js';

const INSTALL_DISMISS_KEY = 'dystrax-install-dismissed';

let deferredPrompt = null;
const availabilityListeners = new Set();

function notifyAvailabilityChange() {
    availabilityListeners.forEach((listener) => {
        try { listener(); } catch { /* un écouteur défaillant ne bloque pas les autres */ }
    });
}

/**
 * iPhone / iPad, y compris l'iPad récent qui se présente comme un Mac tactile.
 */
export function isIOS(
    userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
    platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '',
    maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
) {
    return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/**
 * Détecte que Dystrax tourne déjà comme application installée (PWA-05).
 * `win` est injectable pour les tests.
 */
export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win) return false;
    const displayStandalone = typeof win.matchMedia === 'function'
        && win.matchMedia('(display-mode: standalone)').matches;
    return Boolean(displayStandalone || win.navigator?.standalone === true);
}

export function canInstallPrompt() {
    return Boolean(deferredPrompt);
}

/**
 * Une installation peut être proposée soit via l'invite native (Android/Chrome),
 * soit via le guide manuel sur iPhone.
 */
export function isInstallSupported() {
    return isIOS() || Boolean(deferredPrompt);
}

/**
 * Capture `beforeinstallprompt` au démarrage : l'API n'autorise qu'une seule
 * utilisation différée de l'invite, il faut donc l'intercepter tôt (PWA-02).
 * Retourne une fonction de nettoyage.
 */
export function captureInstallPrompt() {
    if (typeof window === 'undefined') return () => {};

    const onBeforeInstallPrompt = (event) => {
        event.preventDefault();
        deferredPrompt = event;
        notifyAvailabilityChange();
    };
    const onAppInstalled = () => {
        deferredPrompt = null;
        notifyAvailabilityChange();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onAppInstalled);
    };
}

export function onInstallAvailabilityChange(listener) {
    availabilityListeners.add(listener);
    if (deferredPrompt) listener();
    return () => availabilityListeners.delete(listener);
}

export function isInstallDismissed() {
    try { return localStorage.getItem(INSTALL_DISMISS_KEY) === '1'; } catch { return false; }
}

export function dismissInstall() {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, '1'); } catch { /* stockage indisponible */ }
}

/**
 * Déclenche l'invite d'installation native. Retourne `true` si l'utilisateur
 * accepte l'installation (PWA-02).
 */
export async function triggerInstall() {
    if (!deferredPrompt) return false;

    const promptEvent = deferredPrompt;
    deferredPrompt = null;

    try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        return choice?.outcome === 'accepted';
    } catch {
        return false;
    } finally {
        notifyAvailabilityChange();
    }
}

function iosStepsHtml() {
    return `
        <ol style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
            <li>Appuyez sur <strong>Partager</strong> en bas de Safari.</li>
            <li>Choisissez <strong>Sur l'écran d'accueil</strong>.</li>
            <li>Validez avec <strong>Ajouter</strong>.</li>
        </ol>
    `;
}

/**
 * La bannière est masquée si l'application est déjà installée (PWA-05), si
 * l'utilisateur l'a écartée, ou si aucun canal d'installation n'est disponible.
 * Elle laisse la priorité à l'encart push en cours. `options.force` permet de
 * l'afficher depuis l'entrée du profil.
 * Retourne `true` si la bannière a été affichée.
 */
export function offerInstallBanner(message, options = {}) {
    if (typeof document === 'undefined') return false;
    const force = options.force === true;

    if (isStandalone()) return false;
    if (!force && isInstallDismissed()) return false;
    if (document.getElementById('pwa-install-banner')) return false;
    if (document.getElementById('push-optin-banner')) return false;

    const ios = isIOS();
    if (!force && !ios && !deferredPrompt) return false;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = [
        'position: fixed', 'left: 12px', 'right: 12px', 'bottom: 84px',
        'background: var(--bg-main, #ffffff)', 'color: var(--text-main, #111827)',
        'border: 1px solid rgba(0, 0, 0, 0.08)', 'border-radius: 14px',
        'padding: 14px 16px', 'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18)',
        'z-index: 9998', 'display: flex', 'flex-direction: column', 'gap: 10px',
        'font-size: 14px', 'line-height: 1.4',
    ].join(';');
    banner.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: flex-start;">
            <i class="material-icons-round" style="font-size: 20px; color: #6366f1;">install_mobile</i>
            <span>${escapeHtml(message)}</span>
        </div>
        ${ios ? iosStepsHtml() : ''}
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" data-action="later"
                style="background: transparent; border: none; color: var(--text-secondary, #6b7280); font-weight: 600; padding: 8px 12px; cursor: pointer;">
                Plus tard
            </button>
            <button type="button" data-action="install"
                style="background: #6366f1; border: none; color: #ffffff; font-weight: 700; padding: 8px 16px; border-radius: 100px; cursor: pointer;">
                ${ios ? 'Compris' : 'Installer'}
            </button>
        </div>
    `;

    banner.querySelector('[data-action="later"]')?.addEventListener('click', () => {
        dismissInstall();
        banner.remove();
    });
    banner.querySelector('[data-action="install"]')?.addEventListener('click', async () => {
        if (ios) {
            // Les étapes ont été lues : ne plus solliciter l'utilisateur.
            dismissInstall();
        } else {
            await triggerInstall();
        }
        banner.remove();
    });

    document.body.appendChild(banner);
    return true;
}

/**
 * Parcours d'installation déclenché depuis une action explicite (profil).
 * Utilise l'invite native si disponible, sinon affiche les instructions (PWA-03).
 */
export async function startInstallFlow(message) {
    if (isStandalone()) return false;

    if (canInstallPrompt()) {
        return triggerInstall();
    }

    offerInstallBanner(message, { force: true });
    return false;
}
