/**
 * sessionManager.js — Déconnexion automatique après inactivité.
 *
 * Comportement :
 *  - Démarre dès que l'utilisateur est connecté.
 *  - Réinitialise le timer à chaque interaction (click, toucher, frappe, scroll).
 *  - Après INACTIVITY_MS sans activité :
 *      1. Sauvegarde le numéro de téléphone pour pré-remplissage.
 *      2. Déconnecte l'utilisateur (supprime le token).
 *      3. Dispatch 'session-expired' avec { phone } pour la page de login.
 *      4. Toast d'information.
 */

// Le JWT backend a une durée de vie longue (~7 jours). On aligne l'inactivité
// sur cette durée pour ne plus déconnecter prématurément : une notification push
// reçue plusieurs heures (voire plusieurs jours) après la dernière visite doit
// retrouver l'utilisateur encore connecté. Une coupure à 10 min rendait le
// retour depuis une notification impossible (SES-01 / SES-02).
const INACTIVITY_DAYS = 7;
const INACTIVITY_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'touchstart', 'scroll', 'click'];

let _timer   = null;
let _started = false;

function _resetTimer() {
    if (!_started) return;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(_expire, INACTIVITY_MS);
}

async function _expire() {
    try {
        const { api } = await import('../api.js');
        if (!api.isAuthenticated()) return; // déjà déconnecté

        // Récupérer le téléphone avant de supprimer les données
        const user  = JSON.parse(localStorage.getItem('dystrax-user') || 'null');
        const phone = user?.phone || user?.username || '';

        api.logout();
        stop(); // arrêter le gestionnaire

        window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: `Session expirée après ${INACTIVITY_DAYS} jours d'inactivité.`, type: 'info' }
        }));

        window.dispatchEvent(new CustomEvent('session-expired', {
            detail: { phone }
        }));
    } catch (err) {
        console.warn('[sessionManager] Erreur lors de l\'expiration :', err.message);
    }
}

/**
 * Démarre le gestionnaire de session.
 * Appeler après une connexion réussie ou si l'utilisateur est déjà authentifié au chargement.
 */
export function start() {
    if (_started) return;
    _started = true;
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, _resetTimer, { passive: true }));
    _resetTimer();
}

/**
 * Arrête le gestionnaire de session (après déconnexion normale).
 */
export function stop() {
    _started = false;
    if (_timer) { clearTimeout(_timer); _timer = null; }
    ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, _resetTimer));
}
