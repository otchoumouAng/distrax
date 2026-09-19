// Ce module n'a aucune dépendance statique : une erreur de chargement ou de
// syntaxe dans l'application peut être signalée sans bloquer son écran d'état.
window.dispatchEvent(new CustomEvent('dystrax-loading'));
import('./main.ts')
    .then(({ initializeApp }) => {
        initializeApp();
        window.dispatchEvent(new CustomEvent('dystrax-ready'));
    })
    .catch((error) => {
        console.error('Impossible de démarrer Dystrax :', error);
        window.dispatchEvent(new CustomEvent('dystrax-startup-error', {
            // Les détails techniques ne sont visibles que sur le serveur de dev.
            detail: import.meta.env.DEV ? String(error?.message || error) : '',
        }));
    });
