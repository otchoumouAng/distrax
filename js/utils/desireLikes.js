/**
 * Logique du bouton « like ♥ » d'une envie.
 *
 * Ce module est volontairement indépendant du DOM : la carte et la page de
 * détail ne branchent que l'état (lecture/écriture) et les effets de bord.
 * La bascule est optimiste puis réconciliée avec la réponse du serveur ;
 * en cas d'échec, l'état précédent est restauré.
 */

// Statuts de cycle de vie (CAT-04) pour lesquels un like n'a plus de sens :
// l'activité n'est plus proposée aux participants.
const LIKE_DISABLED_STATUSES = new Set(['cancelled', 'archived', 'realized', 'not_realized']);

/**
 * Le like est-il verrouillé ? Vrai pour une activité passée ou un statut
 * terminal (annulée, archivée, réalisée, non réalisée).
 * @param {{mode?: string, status?: string}} [state]
 * @returns {boolean}
 */
export function isLikeDisabled({ mode = 'default', status = '' } = {}) {
    if (mode === 'past') return true;
    return LIKE_DISABLED_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * Normalise un compteur de likes : entier positif, 0 par défaut.
 * @param {*} value
 * @returns {number}
 */
export function parseLikeCount(value) {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * Interprète un attribut booléen (`liked`) : absent → faux,
 * `false` / `0` explicites → faux, sinon vrai.
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function isTruthyAttribute(value) {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
}

/**
 * État après bascule : le compteur suit le sens du changement sans jamais
 * descendre sous zéro.
 * @param {{liked?: boolean, likeCount?: number}} [current]
 * @returns {{liked: boolean, likeCount: number}}
 */
export function nextLikeState({ liked = false, likeCount = 0 } = {}) {
    const currentlyLiked = liked === true;
    return {
        liked: !currentlyLiked,
        likeCount: Math.max(0, parseLikeCount(likeCount) + (currentlyLiked ? -1 : 1)),
    };
}

/**
 * Réconcilie l'état optimiste avec la réponse du serveur
 * (`{liked, like_count}`), en retombant sur l'état optimiste si un champ manque.
 * @param {{liked?: boolean, like_count?: number}} response
 * @param {{liked: boolean, likeCount: number}} fallback
 * @returns {{liked: boolean, likeCount: number}}
 */
export function resolveLikeResponse(response, fallback) {
    return {
        liked: typeof response?.liked === 'boolean' ? response.liked : fallback.liked,
        likeCount: response?.like_count != null ? parseLikeCount(response.like_count) : fallback.likeCount,
    };
}

/**
 * Bascule un like : appel de l'API puis réconciliation.
 * Ne touche pas au DOM — l'appelant applique `state` (et `optimistic` s'il
 * veut un retour visuel immédiat).
 * @param {{desireId: string|number|null, liked?: boolean, likeCount?: number}} current
 * @param {{likeDesire: Function, unlikeDesire: Function}} api
 * @returns {Promise<{ok: boolean, previous: object, optimistic: object, state: object, error: Error|null}>}
 */
export async function toggleDesireLike(current, api) {
    const previous = {
        desireId: current?.desireId ?? null,
        liked: current?.liked === true,
        likeCount: parseLikeCount(current?.likeCount),
    };
    const optimistic = nextLikeState(previous);

    try {
        const response = previous.liked
            ? await api.unlikeDesire(previous.desireId)
            : await api.likeDesire(previous.desireId);
        return {
            ok: true,
            previous,
            optimistic,
            state: resolveLikeResponse(response, optimistic),
            error: null,
        };
    } catch (error) {
        return { ok: false, previous, optimistic, state: previous, error };
    }
}

/**
 * Contrôleur de like partagé par la carte et la page de détail.
 *
 * @param {object} deps
 * @param {() => {desireId: string|number|null, liked: boolean, likeCount: number}} deps.readState
 * @param {(state: {liked: boolean, likeCount: number}) => void} deps.writeState
 * @param {(state: {liked: boolean, likeCount: number}) => void} [deps.onChange] succès réconcilié
 * @param {(error: Error) => void} [deps.onError] échec (l'état est déjà restauré)
 * @param {() => Promise<{likeDesire: Function, unlikeDesire: Function}>} deps.loadApi
 * @returns {{isPending: () => boolean, toggle: () => Promise<object>}}
 */
export function createLikeController({ readState, writeState, onChange, onError, loadApi }) {
    let pending = false;

    return {
        isPending: () => pending,

        /** Applique la bascule optimiste, appelle l'API puis réconcilie. */
        async toggle() {
            if (pending) return { ok: false, skipped: true, state: null, error: null };

            const snapshot = readState() || {};
            const previous = {
                desireId: snapshot.desireId ?? null,
                liked: snapshot.liked === true,
                likeCount: parseLikeCount(snapshot.likeCount),
            };
            if (!previous.desireId) return { ok: false, skipped: true, state: null, error: null };

            pending = true;
            // Retour visuel immédiat, avant la réponse réseau.
            writeState(nextLikeState(previous));

            try {
                const api = await loadApi();
                const result = await toggleDesireLike(previous, api);
                writeState(result.state);
                if (result.ok) {
                    onChange?.(result.state);
                } else {
                    onError?.(result.error);
                }
                return result;
            } catch (error) {
                writeState(previous);
                onError?.(error);
                return { ok: false, previous, state: previous, error };
            } finally {
                pending = false;
            }
        },
    };
}

/**
 * Branchement du clic sur le bouton ♥ : le clic ne doit jamais remonter,
 * sinon la carte se navigue au clic.
 * @param {{stopPropagation: Function, preventDefault?: Function}} event
 * @param {{toggle: Function}} controller
 */
export function handleLikeButtonClick(event, controller) {
    event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
    return controller.toggle();
}

/**
 * Génère le HTML du bouton ♥ d'une carte (icône pleine si aimée).
 * @param {{liked?: boolean, likeCount?: number, disabled?: boolean}} [state]
 * @returns {string}
 */
export function buildLikeButtonHtml({ liked = false, likeCount = 0, disabled = false } = {}) {
    const active = liked === true;
    const label = active ? 'Retirer mon like' : 'Aimer cette envie';
    return `
        <button class="like-btn${active ? ' is-active' : ''}" type="button" data-like-btn
                aria-pressed="${active ? 'true' : 'false'}"
                aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}>
            <i class="material-icons-round">${active ? 'favorite' : 'favorite_border'}</i>
            <span class="like-count">${parseLikeCount(likeCount)}</span>
        </button>`;
}
