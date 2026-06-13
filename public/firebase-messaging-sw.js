// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// On doit récupérer ces infos via des query params ou les hardcoder s'ils sont publics.
// Les variables d'environnement Vite ne sont pas directement accessibles ici.
// Par convention, soit on a un fichier de config séparé, soit on les injecte au build.
// Ici, on va utiliser la configuration par défaut. Assurez-vous d'injecter la bonne config
// au moment du build ou en remplaçant ce fichier via un script.

// Le développeur devra remplacer ces valeurs factices par celles de son projet Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDuSWjg0SuwTW_2rtwdzJ-uWHIGWJ0O050",
    projectId: "distrax-7056b",
    messagingSenderId: "26607047645",
    appId: "1:26607047645:web:cfeea2e187d3e53eaa5c34"
};

// Initialisation conditionnelle pour éviter les erreurs si la config est vide
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'REPLACE_WITH_API_KEY') {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function(payload) {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || 'Distrax';
        const notificationOptions = {
            body: payload.notification?.body,
            icon: '/assets/img/logo.png', // Le logo favicon
            data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    // Gérer l'action au clic sur la notification
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            if (windowClients.length > 0) {
                // Focus sur la fenêtre existante
                windowClients[0].focus();
                // On peut aussi lui envoyer un message
                windowClients[0].postMessage({ type: 'FCM_CLICK', data: event.notification.data });
            } else {
                // Ouvrir l'application
                clients.openWindow('/');
            }
        })
    );
});
