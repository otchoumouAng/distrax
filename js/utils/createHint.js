// Accroche du bouton de création d'envie (pulsation + bulle).
// Elle n'est montrée qu'une seule fois, à la première visite, puis mémorisée
// pour ne jamais réapparaître. Le stockage est injectable pour les tests.

export const CREATE_HINT_DISMISS_KEY = 'dystrax-create-hint-dismissed';

function defaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null; // accès bloqué (navigation privée, cookies désactivés)
    }
}

/** L'accroche a-t-elle déjà été vue (donc ne doit plus s'afficher) ? */
export function isCreateHintDismissed(storage = defaultStorage()) {
    try {
        return storage?.getItem(CREATE_HINT_DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

/** Mémorise définitivement que l'accroche a été vue. */
export function dismissCreateHint(storage = defaultStorage()) {
    try {
        storage?.setItem(CREATE_HINT_DISMISS_KEY, '1');
    } catch {
        /* quota atteint / mode privé : on n'empêche pas l'app de fonctionner */
    }
}

/** L'accroche doit-elle s'afficher ? (jamais vue auparavant) */
export function shouldShowCreateHint(storage = defaultStorage()) {
    return !isCreateHintDismissed(storage);
}
