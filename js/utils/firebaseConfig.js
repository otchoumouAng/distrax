// firebaseConfig.js
// Initialisation de Firebase et de Cloud Messaging
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { api } from '../api.js';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

let app;
let messaging;

export function initFirebase() {
    if (!firebaseConfig.apiKey) {
        console.warn('Firebase non configuré (VITE_FIREBASE_API_KEY manquant).');
        return;
    }

    try {
        app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        
        // Listener pour les notifications au premier plan (Foreground)
        onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            // Afficher le toast personnalisé de l'application
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: {
                    message: payload.notification?.body || 'Nouvelle notification',
                    type: 'info'
                }
            }));
            
            // Actualiser le badge des notifications si besoin
            window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
        });
        
    } catch (e) {
        console.error('Erreur initialisation Firebase: ', e);
    }
}

/**
 * Demande la permission à l'utilisateur et récupère le Token FCM.
 * Envoie le token au backend si l'utilisateur est connecté.
 */
export async function requestNotificationPermissionAndRegister() {
    if (!messaging) return false;
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getToken(messaging, { 
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY 
            });
            
            if (currentToken) {
                console.log('FCM Token récupéré.');
                // Enregistrer le token sur le backend
                if (api.isAuthenticated()) {
                    await api.registerDeviceToken(currentToken, 'web');
                }
                return true;
            } else {
                console.warn('Aucun token de registre disponible. Demander la permission de générer un token.');
                return false;
            }
        } else {
            console.warn('Permission de notification non accordée.');
            return false;
        }
    } catch (err) {
        console.error('Erreur lors de la récupération du token:', err);
        return false;
    }
}

/**
 * Supprime le token actuel (à appeler lors de la déconnexion).
 */
export async function deleteCurrentToken() {
    if (!messaging) return;
    try {
        const currentToken = await getToken(messaging, { 
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY 
        });
        if (currentToken) {
            await api.deleteDeviceToken(currentToken);
        }
    } catch (e) {
        console.warn('Impossible de supprimer le token FCM:', e);
    }
}
