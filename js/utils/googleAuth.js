import { api } from '../api.js';

/**
 * Initialise Google Identity Services
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

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            try {
                // response.credential contient l'id_token signé par Google
                const data = await api.loginWithGoogle(response.credential);
                if (onLoginSuccess) onLoginSuccess(data);
            } catch (err) {
                console.error('Erreur lors de la vérification Google sur le backend:', err);
                if (onLoginError) onLoginError(err);
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
