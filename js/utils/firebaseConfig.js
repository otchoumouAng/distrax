// Initialisation de Firebase et de Cloud Messaging
import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from '../api.js';
import { extractPushData } from './pushNavigation.js';
import { escapeHtml } from './escapeHtml.js';
import { isIOS, isStandalone } from './installPWA.js';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const TOKEN_STORAGE_KEY = 'dystrax-fcm-token';
const PUSH_OPTOUT_KEY = 'dystrax-push-optout';

let messaging;
let serviceWorkerRegistration;
let initializationPromise;
let foregroundListenerRegistered = false;

function hasFirebaseConfig() {
    return Object.values(firebaseConfig).every(value => typeof value === 'string' && value.trim());
}

/**
 * Sur iPhone, le push n'existe qu'une fois Dystrax ajouté à l'écran d'accueil
 * et après une action explicite (PWA-04). Tant que ces conditions ne sont pas
 * réunies, aucune demande d'autorisation ne doit être affichée.
 */
function isIOSPushUnavailable() {
    return isIOS() && !isStandalone();
}

function buildServiceWorkerUrl() {
    const url = new URL('/firebase-messaging-sw.js', window.location.origin);
    Object.entries(firebaseConfig).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
}

async function registerMessagingServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Les service workers ne sont pas pris en charge par ce navigateur.');
    }

    const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(), { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
}

function registerForegroundListener() {
    if (foregroundListenerRegistered || !messaging) return;
    foregroundListenerRegistered = true;

    onMessage(messaging, (payload) => {
        const data = extractPushData(payload);

        window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
                message: data.body || 'Nouvelle notification',
                type: 'info',
                actionLabel: data.desire_id || data.url ? 'Voir' : '',
                actionEvent: data.desire_id || data.url ? 'open-push-destination' : '',
                actionDetail: payload,
            },
        }));

        window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
    });
}

async function initializeFirebaseMessaging() {
    if (!hasFirebaseConfig()) {
        console.warn(
            'Firebase non configuré — les notifications push sont désactivées.\n' +
            'Renseignez les variables VITE_FIREBASE_* dans l’environnement de build.'
        );
        return null;
    }

    try {
        if (!await isSupported()) {
            console.info('Les notifications push Firebase ne sont pas prises en charge par ce navigateur.');
            return null;
        }

        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        serviceWorkerRegistration = await registerMessagingServiceWorker();
        messaging = getMessaging(app);
        registerForegroundListener();
        return { messaging, serviceWorkerRegistration };
    } catch (error) {
        console.error('Erreur lors de l’initialisation Firebase :', error);
        return null;
    }
}

/**
 * Initialise la réception FCM et réutilise une seule promesse pour éviter les
 * enregistrements concurrents au démarrage et juste après l'authentification.
 */
export function initFirebase() {
    if (!initializationPromise) {
        initializationPromise = initializeFirebaseMessaging();
    }
    return initializationPromise;
}

async function getCurrentToken() {
    const initialized = await initFirebase();
    if (!initialized) return '';

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
        console.warn('VITE_FIREBASE_VAPID_KEY est absent — impossible de créer le jeton push.');
        return '';
    }

    return getToken(initialized.messaging, {
        vapidKey,
        serviceWorkerRegistration: initialized.serviceWorkerRegistration,
    });
}

async function registerCurrentDeviceToken() {
    const currentToken = await getCurrentToken();
    if (!currentToken) return false;

    localStorage.setItem(TOKEN_STORAGE_KEY, currentToken);
    if (api.isAuthenticated()) {
        await api.registerDeviceToken(currentToken, 'web');
    }
    return true;
}

/**
 * Réenregistre silencieusement l'appareil si l'utilisateur avait déjà accordé
 * le push. Cette fonction n'affiche jamais la demande système d'autorisation.
 */
export async function registerDeviceForExistingPermission() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return false;
    }
    if (isIOSPushUnavailable()) return false;

    try {
        return await registerCurrentDeviceToken();
    } catch (error) {
        console.warn('Impossible de réenregistrer le jeton FCM :', error);
        return false;
    }
}

/**
 * Demande la permission à l'utilisateur et récupère le Token FCM.
 * Le moment où cette fonction est appelée reste géré par le parcours existant.
 */
export async function requestNotificationPermissionAndRegister() {
    if (typeof Notification === 'undefined') return false;
    if (isIOSPushUnavailable()) return false;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Permission de notification non accordée.');
            return false;
        }

        return await registerCurrentDeviceToken();
    } catch (error) {
        console.error('Erreur lors de la récupération du jeton FCM :', error);
        return false;
    }
}

/**
 * Affiche un encart contextuel invitant l'utilisateur à activer les notifications.
 * La demande système n'est déclenchée qu'au clic de l'utilisateur (OPT-05) et
 * jamais si la permission est déjà accordée/refusée ou après un refus mémorisé.
 */
export function offerPushOptIn(message) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    if (isIOSPushUnavailable()) return;
    if (localStorage.getItem(PUSH_OPTOUT_KEY) === '1') return;
    if (document.getElementById('push-optin-banner')) return;

    // L'encart push est prioritaire : il remplace un éventuel encart d'installation.
    document.getElementById('pwa-install-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'push-optin-banner';
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
            <i class="material-icons-round" style="font-size: 20px; color: #6366f1;">notifications_active</i>
            <span>${escapeHtml(message)}</span>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" data-action="later"
                style="background: transparent; border: none; color: var(--text-secondary, #6b7280); font-weight: 600; padding: 8px 12px; cursor: pointer;">
                Plus tard
            </button>
            <button type="button" data-action="enable"
                style="background: #6366f1; border: none; color: #ffffff; font-weight: 700; padding: 8px 16px; border-radius: 100px; cursor: pointer;">
                Activer
            </button>
        </div>
    `;

    banner.querySelector('[data-action="later"]')?.addEventListener('click', () => {
        try { localStorage.setItem(PUSH_OPTOUT_KEY, '1'); } catch { /* stockage indisponible */ }
        banner.remove();
    });
    banner.querySelector('[data-action="enable"]')?.addEventListener('click', () => {
        requestNotificationPermissionAndRegister().catch(() => {});
        banner.remove();
    });

    document.body.appendChild(banner);
}

/**
 * Retire l'association backend avant de supprimer le jeton Firebase local.
 * L'appelant doit attendre la fin de cette fonction avant de vider la session.
 */
export async function deleteCurrentToken() {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    let currentToken = storedToken;

    try {
        if (!currentToken && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            currentToken = await getCurrentToken();
        }
    } catch (error) {
        console.warn('Impossible de retrouver le jeton FCM courant :', error);
    }

    try {
        if (currentToken && api.isAuthenticated()) {
            await api.deleteDeviceToken(currentToken);
        }
    } catch (error) {
        console.warn('Impossible de retirer le jeton FCM du compte :', error);
    }

    try {
        const initialized = await initFirebase();
        if (initialized) {
            await deleteToken(initialized.messaging);
        }
    } catch (error) {
        console.warn('Impossible de supprimer le jeton FCM du navigateur :', error);
    } finally {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
}
