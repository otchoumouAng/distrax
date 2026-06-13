import { DEFAULT_AVATAR_PATH } from './escapeHtml.js';
import { formatSpotsLabel } from './formatSpots.js';

const THEME_BY_CATEGORY = {
    sport: 'sport',
    detente: 'chill',
    apprentissage: 'learn',
    rencontres: 'rencontres',
    sorties: 'explore',
    decouverte: 'explore',
};

export function themeFromCategory(category) {
    return THEME_BY_CATEGORY[category] || 'explore';
}

export function formatDesireDate(isoDate) {
    if (!isoDate) return 'Date à confirmer';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Date à confirmer';

    return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDesirePrice(desire) {
    if (desire?.price_type === 'free') return 'Gratuit';
    if (desire?.price_type === 'contribution') return 'Contribution libre';

    const amount = Number(desire?.price_amount);
    return amount ? `${amount.toLocaleString('fr-FR')} FCFA` : 'Payant';
}

export function timeAgo(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'A l\'instant';

    const diffSeconds = (Date.now() - date.getTime()) / 1000;
    if (diffSeconds < 60) return 'A l\'instant';
    if (diffSeconds < 3600) return `Il y a ${Math.floor(diffSeconds / 60)} min`;
    if (diffSeconds < 86400) return `Il y a ${Math.floor(diffSeconds / 3600)}h`;

    return `Il y a ${Math.floor(diffSeconds / 86400)} jour(s)`;
}

export function buildDesireViewDetail(desire) {
    return {
        id: desire?.id,
        authorId: desire?.author_id || null,
        title: desire?.title || '',
        author: desire?.author_pseudo || 'Anonyme',
        theme: themeFromCategory(desire?.category),
        timeAgo: timeAgo(desire?.created_at),
        commune: desire?.commune || 'Abidjan',
        date: formatDesireDate(desire?.event_date),
        spots: formatSpotsLabel(desire?.spots_taken, desire?.max_spots),
        price: formatDesirePrice(desire),
        avatar: desire?.author_avatar_url || DEFAULT_AVATAR_PATH,
        images: Array.isArray(desire?.images) ? desire.images : [],
        description: desire?.description || '',
        price_type: desire?.price_type,
    };
}

export function createDesireCard(desire, options = {}) {
    const {
        myUserId = null,
        joinedDesireIds = null,
        openDetailsOnJoin = true,
    } = options;

    const card = document.createElement('desire-card');
    const viewDetail = buildDesireViewDetail(desire);

    card.setAttribute('theme', viewDetail.theme);
    card.setAttribute('title', desire?.title || '');
    card.setAttribute('author', desire?.author_pseudo || 'Anonyme');
    card.setAttribute('time-ago', viewDetail.timeAgo);
    card.setAttribute('avatar', desire?.author_avatar_url || DEFAULT_AVATAR_PATH);
    card.setAttribute('date', viewDetail.date);
    card.setAttribute('price', viewDetail.price);
    card.setAttribute('commune', desire?.commune || 'Abidjan');
    card.setAttribute('spots', viewDetail.spots);
    card.setAttribute('navigate-on-card', '');
    card.setAttribute('btn-text', 'Rejoindre');
    card.setAttribute('images', Array.isArray(desire?.images) && desire.images.length > 0 ? desire.images.join(',') : '');
    card.setAttribute('description', desire?.description || '');
    card.dataset.desireId = desire?.id || '';
    card.dataset.authorId = desire?.author_id || '';

    if (desire?.id) {
        card.setAttribute('desire-id', desire.id);
    }

    if (desire?.view_count != null) {
        card.setAttribute('view-count', String(desire.view_count));
    }

    if (desire?.is_boosted) {
        card.setAttribute('is-boosted', '');
    }

    if (myUserId && desire?.author_id && myUserId === desire.author_id) {
        card.setAttribute('mode', 'owner');
    } else if (joinedDesireIds instanceof Set && joinedDesireIds.has(String(desire?.id || ''))) {
        card.setAttribute('mode', 'pending');
    }

    if (openDetailsOnJoin) {
        card.addEventListener('desire-joined', (event) => {
            event.stopPropagation();
            card.dispatchEvent(new CustomEvent('view-desire', {
                detail: viewDetail,
                bubbles: true,
                composed: true,
            }));
        });
    }

    return card;
}
