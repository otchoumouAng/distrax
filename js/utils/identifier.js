// Saisie de l'identifiant d'un compte : numéro de téléphone ou adresse email.
// Les comptes créés via Google n'ont pas de numéro : l'email est leur seul
// moyen de se faire reconnaître, à la connexion comme au mot de passe oublié.

const PHONE_PATTERN = /^\+?\d{8,15}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Vrai si la saisie ressemble à une adresse email plutôt qu'à un numéro. */
export function looksLikeEmail(value) {
    return String(value ?? '').includes('@');
}

/** Vrai si la saisie est un numéro de téléphone exploitable. */
export function isValidPhone(value) {
    return PHONE_PATTERN.test(String(value ?? '').trim());
}

/** Vrai si la saisie est une adresse email exploitable. */
export function isValidEmail(value) {
    return EMAIL_PATTERN.test(String(value ?? '').trim());
}

/** Vrai si la saisie est un numéro de téléphone ou une adresse email valide. */
export function isValidIdentifier(value) {
    return isValidPhone(value) || isValidEmail(value);
}

/** Message d'erreur à afficher, ou `null` si la saisie est exploitable. */
export function identifierError(value) {
    if (!String(value ?? '').trim()) {
        return 'Saisissez votre numéro de téléphone ou votre adresse email.';
    }
    if (!isValidIdentifier(value)) {
        return 'Saisissez un numéro de téléphone ou une adresse email valide.';
    }
    return null;
}
