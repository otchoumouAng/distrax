import { api } from '../api.js';

// Singleton GSI : google.accounts.id.initialize() ne doit être appelé qu'une seule fois.
let _gsiInitialized = false;
let _onLoginSuccess = null;
let _onLoginError = null;

/**
 * Initialise Google Identity Services (appelable plusieurs fois sans effet négatif —
 * seule la première initialisation effective est conservée, les appels suivants
 * mettent simplement à jour les callbacks).
 * @param {Function} onLoginSuccess Callback appelé quand le backend a validé le token et renvoyé le JWT
 * @param {Function} onLoginError Callback appelé en cas d'erreur
 */
export function initializeGoogleAuth(onLoginSuccess, onLoginError) {
    const clientId = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || '';
    
    if (!clientId) {
        console.warn('VITE_GOOGLE_CLIENT_ID est manquant. Authentification Google désactivée.');
        return false;
    }
    
    if (!window.google) {
        console.warn('Script Google Identity non chargé.');
        return false;
    }

    // Mettre à jour les callbacks pour pointer vers la page active
    _onLoginSuccess = onLoginSuccess;
    _onLoginError = onLoginError;

    // Éviter l'initialisation multiple : GSI ne supporte qu'un seul initialize()
    if (_gsiInitialized) return true;

    _gsiInitialized = true;
    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            try {
                const data = await api.loginWithGoogle(response.credential);
                if (_onLoginSuccess) _onLoginSuccess(data);
            } catch (err) {
                console.error('Erreur lors de la vérification Google sur le backend:', err);
                if (_onLoginError) _onLoginError(err);
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
