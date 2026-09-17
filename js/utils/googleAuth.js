import { api } from '../api.js';

// Singleton GSI : google.accounts.id.initialize() ne doit être appelé qu'une seule fois.
let _gsiInitialized = false;

// Les pages Login et Register coexistent dans le DOM : les callbacks sont donc
// indexés par page, et seule la page active traite la réponse Google.
const _handlers = new Map();
let _activeScope = null;

/**
 * Déclare la page qui doit traiter la prochaine réponse Google.
 * À appeler à l'affichage de la page (show()).
 * @param {String} scope Identifiant de page ('login', 'register')
 */
export function setActiveGoogleAuthScope(scope) {
    _activeScope = scope;
}

/**
 * Initialise Google Identity Services (appelable plusieurs fois sans effet négatif —
 * seule la première initialisation effective est conservée, les appels suivants
 * enregistrent simplement les callbacks de la page concernée).
 * @param {String} scope Identifiant de page ('login', 'register')
 * @param {Function} onLoginSuccess Callback appelé quand le backend a validé le token et renvoyé le JWT
 * @param {Function} onLoginError Callback appelé en cas d'erreur
 */
export function initializeGoogleAuth(scope, onLoginSuccess, onLoginError) {
    const clientId = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || '';
    
    if (!clientId) {
        console.warn('VITE_GOOGLE_CLIENT_ID est manquant. Authentification Google désactivée.');
        return false;
    }
    
    if (!window.google) {
        console.warn('Script Google Identity non chargé.');
        return false;
    }

    _handlers.set(scope, { onLoginSuccess, onLoginError });
    if (!_activeScope) _activeScope = scope;

    // Éviter l'initialisation multiple : GSI ne supporte qu'un seul initialize()
    if (_gsiInitialized) return true;

    _gsiInitialized = true;
    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            const handlers = _handlers.get(_activeScope) || {};
            let data;
            try {
                data = await api.loginWithGoogle(response.credential);
            } catch (err) {
                console.error('Erreur lors de la vérification Google sur le backend:', err);
                if (handlers.onLoginError) handlers.onLoginError(err);
                return;
            }
            // Le token est déjà persisté par api.loginWithGoogle() : le handler peut
            // mettre à jour l'UI immédiatement. On l'attend pour capturer ses erreurs.
            if (handlers.onLoginSuccess) {
                try {
                    await handlers.onLoginSuccess(data);
                } catch (err) {
                    console.error('Erreur lors du traitement post-connexion Google:', err);
                }
            }
        }
    });
    
    return true;
}

/**
 * Rendu du bouton Google officiel
 * @param {HTMLElement} containerElement Élément du DOM où afficher le bouton
 * @param {String} textType 'continue_with' ou 'signup_with'
 */
export function renderGoogleButton(containerElement, textType = 'continue_with') {
    if (!window.google || !containerElement) return;
    
    // Vide le conteneur (pour remplacer un éventuel bouton custom factice)
    containerElement.innerHTML = '';
    containerElement.style.display = 'flex';
    containerElement.style.justifyContent = 'center';
    
    window.google.accounts.id.renderButton(
        containerElement,
        { 
            theme: 'outline', 
            size: 'large', 
            type: 'standard', 
            shape: 'rectangular', 
            text: textType,
            logo_alignment: 'center',
            width: containerElement.clientWidth > 0 ? containerElement.clientWidth : 300
        }
    );
}
