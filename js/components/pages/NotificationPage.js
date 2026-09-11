import { escapeHtml } from '../../utils/escapeHtml.js';
import { getNotificationFocus } from '../../utils/pushNavigation.js';

const NOTIFICATION_TYPES = {
    join_request: { icon: 'group_add', color: '#6366f1', label: 'Nouvelle demande' },
    join_accepted: { icon: 'check_circle', color: '#10b981', label: 'Demande acceptée' },
    join_rejected: { icon: 'cancel', color: '#ef4444', label: 'Demande refusée' },
    new_desire: { icon: 'interests', color: '#f59e0b', label: 'Nouvelle envie' },
    organizer_keep: { icon: 'event_available', color: '#f59e0b', label: 'Maintien à confirmer' },
    reminder_day: { icon: 'event', color: '#0ea5e9', label: 'Rappel veille' },
    reminder_soon: { icon: 'directions_run', color: '#f59e0b', label: 'Départ bientôt' },
    desire_updated: { icon: 'edit_calendar', color: '#6366f1', label: 'Modification importante' },
    desire_cancelled: { icon: 'event_busy', color: '#ef4444', label: 'Activité annulée' },
};

export function getNotificationMeta(type) {
    return NOTIFICATION_TYPES[type] || { icon: 'notifications', color: 'var(--primary)', label: 'Information' };
}

// Types pour lesquels le contact de l'organisateur est mis en avant (PAR-16).
const CONTACT_TYPES = new Set(['join_accepted', 'reminder_day', 'reminder_soon']);

export function getRelatedDesireId(notification = {}) {
    return notification.related_desire_id
        ?? notification.extra_data?.desire_id
        ?? notification.extra_data?.desireId
        ?? notification.desire_id
        ?? notification.desireId
        ?? '';
}

export function getNotificationNavigation(notification = {}) {
    const desireId = getRelatedDesireId(notification);
    if (!desireId) return null;

    // Chaque type du catalogue §12.2 ouvre l'action attendue (NIN-06) ; sans
    // cible connue, on ouvre simplement l'envie concernée.
    const focus = getNotificationFocus(notification.type);
    return focus
        ? { id: String(desireId), focus }
        : { id: String(desireId) };
}

/** Corps affiché : regroupe les demandes rapprochées en un seul message (NIN-08). */
export function getNotificationBodyText(notification = {}) {
    const count = Number(notification.extra_data?.pending_count);
    if (notification.type === 'join_request' && Number.isFinite(count) && count > 1) {
        return `${count} personnes souhaitent rejoindre votre envie.`;
    }
    return String(notification.body ?? notification.message ?? 'Aucun détail supplémentaire.');
}

export function formatNotificationDate(value) {
    if (value === null || value === undefined || value === '') {
        return { label: 'Date inconnue', iso: '' };
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { label: 'Date inconnue', iso: '' };
    }

    return {
        label: date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
        iso: date.toISOString(),
    };
}

export function getNotificationViewModel(notification = {}) {
    const meta = getNotificationMeta(notification.type);
    const title = typeof notification.title === 'string' && notification.title.trim()
        ? notification.title.trim()
        : meta.label;
    const body = getNotificationBodyText(notification);

    return {
        meta,
        title: String(title),
        body: String(body),
        desireId: getRelatedDesireId(notification),
        isRead: notification.is_read === true,
        date: formatNotificationDate(notification.created_at),
    };
}

export class NotificationPage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="page-section notification-page" id="notificationPage" style="display: none;">
                <header class="results-header" style="position: sticky; top: 0; z-index: 50;">
                    <div class="header-content">
                        <div class="header-title-group">
                            <button class="results-back-btn back-to-home" title="Retour" aria-label="Retour">
                                <i class="material-icons-round">arrow_back</i>
                            </button>
                            <div class="header-icon"><i class="material-icons-round">notifications</i></div>
                            <h1 class="header-title">Notifications</h1>
                        </div>
                        <button id="markAllReadBtn" style="background: none; border: none; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; padding: 8px;">
                            Tout marquer lu
                        </button>
                    </div>
                </header>

                <div class="page-content" style="padding: 24px;">
                    <div id="notifContainer" style="max-width: 600px; margin: 0 auto;">
                        <div id="notifList" class="notifications-list" aria-live="polite" style="display: flex; flex-direction: column; gap: 16px;">
                            <p style="color: var(--text-muted); text-align: center; padding: 40px 0;">Chargement...</p>
                        </div>
                        <div id="notifLoadMore" class="notifications-load-more-wrap" style="display: none; text-align: center;">
                            <button type="button" id="voirPlusNotifBtn" class="notifications-load-more-btn" aria-label="Charger plus de notifications">
                                <i class="material-icons-round" aria-hidden="true">expand_more</i>
                                <span class="notifications-load-more-label">Voir plus</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const backBtn = this.querySelector('.back-to-home');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
            });
        }

        const markAllBtn = this.querySelector('#markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', async () => {
                const { api } = await import('../../api.js');
                await api.markAllNotificationsRead().catch(() => { });
                window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
                this.loadNotifications(false);
            });
        }

        const voirPlusBtn = this.querySelector('#voirPlusNotifBtn');
        if (voirPlusBtn) {
            voirPlusBtn.addEventListener('click', () => this.loadNotifications(true));
        }
    }

    /** Icône + couleur selon le type de notification */
    _notifMeta(type) {
        return getNotificationMeta(type);
    }

    /** @param {boolean} [append=false] — true = charger 10 de plus et les ajouter à la liste */
    async loadNotifications(append = false) {
        const list = this.querySelector('#notifList');
        const loadMoreWrap = this.querySelector('#notifLoadMore');
        const voirPlusBtn = this.querySelector('#voirPlusNotifBtn');
        const PAGE_SIZE = 10;

        if (!append) {
            this._notifItems = [];
            this._notifOffset = 0;
            this._notifTotal = 0;
        }

        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) {
                list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">Connectez-vous pour voir vos notifications.</p>`;
                if (loadMoreWrap) loadMoreWrap.style.display = 'none';
                return;
            }

            if (!append) {
                list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">Chargement...</p>';
                if (loadMoreWrap) loadMoreWrap.style.display = 'none';
            } else if (voirPlusBtn) {
                voirPlusBtn.disabled = true;
                const label = voirPlusBtn.querySelector('.notifications-load-more-label');
                if (label) label.textContent = 'Chargement…';
                else voirPlusBtn.textContent = 'Chargement…';
            }

            const data = await api.getNotifications(PAGE_SIZE, this._notifOffset ?? 0);
            const notifs = data?.items ?? [];
            const total = data?.total ?? 0;

            if (!append && (!notifs || notifs.length === 0)) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                        <i class="material-icons-round" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 12px;">notifications_none</i>
                        <p>Aucune notification pour le moment.</p>
                    </div>`;
                if (loadMoreWrap) loadMoreWrap.style.display = 'none';
                return;
            }

            this._notifItems = this._notifItems || [];
            this._notifItems.push(...notifs);
            this._notifOffset = (this._notifOffset ?? 0) + notifs.length;
            this._notifTotal = total;

            // Formate un numéro pour wa.me : retire symboles, gère code pays CI (0XXXXXXXXX → 225XXXXXXXXX)
            const waPhone = (p) => p.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '225');

            list.innerHTML = this._notifItems.map(n => {
                const view = getNotificationViewModel(n);
                const meta = view.meta;
                const phone = n.extra_data?.creator_phone;
                const hostName = n.extra_data?.creator_pseudo || 'l\'organisateur';
                let bodyText = escapeHtml(view.body);
                if (n.type === 'join_accepted') {
                    bodyText = bodyText.replace('Contactez l&#39;organisateur pour la suite !', 'Contactez ' + escapeHtml(hostName) + ' pour la suite !');
                }
                const desireId = view.desireId;
                const phoneSafe = phone ? String(phone).replace(/[^\d+]/g, '') : '';
                const contactBlock = (CONTACT_TYPES.has(n.type) && phoneSafe) ? `
                <div style="display:flex; align-items:center; gap:8px; margin-top:10px; padding:10px 12px; background:color-mix(in srgb,#10b981 8%,transparent); border-radius:10px; border:1px solid color-mix(in srgb,#10b981 25%,transparent);">
                    <i class="material-icons-round" style="font-size:18px; color:#059669; flex-shrink:0;">phone</i>
                    <span style="font-size:13px; font-weight:600; color:var(--text-main); flex:1; letter-spacing:0.5px;">${escapeHtml(phone)}</span>
                    <a href="tel:${escapeHtml(phoneSafe)}" data-notification-action title="Appeler ${escapeHtml(hostName)}"
                        style="width:34px; height:34px; border-radius:50%; background:#059669; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0;">
                        <i class="material-icons-round" style="font-size:17px;">call</i>
                    </a>
                    <a href="https://wa.me/${waPhone(phoneSafe)}" data-notification-action target="_blank" rel="noopener" title="WhatsApp ${escapeHtml(hostName)}"
                        style="width:34px; height:34px; border-radius:50%; background:#25d366; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0;">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white;" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                    </a>
                </div>` : '';

                return `
                <article class="notification-item ${view.isRead ? '' : 'unread'}" data-notif-id="${escapeHtml(String(n.id))}" data-is-read="${view.isRead}" data-notif-type="${escapeHtml(n.type || '')}" data-desire-id="${escapeHtml(String(desireId || ''))}"
                    role="button" tabindex="0" aria-label="Notification ${view.isRead ? 'lue' : 'non lue'} : ${escapeHtml(view.title)}"
                    style="background: ${view.isRead ? 'var(--bg-card)' : 'color-mix(in srgb, var(--primary) 5%, transparent)'};
                           border: 1px solid ${view.isRead ? 'var(--border-light)' : 'color-mix(in srgb, var(--primary) 20%, transparent)'};
                           padding: 16px; border-radius: 16px; display: flex; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                           cursor: pointer; transition: opacity 0.2s; flex-direction: column;">
                    <div style="display:flex; gap:16px; align-items:flex-start;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: ${meta.color}; color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="material-icons-round">${escapeHtml(meta.icon)}</i>
                        </div>
                        <div class="notif-body" style="flex: 1; min-width:0;">
                            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                                <h2 class="notification-title" style="margin:0; font-size:15px; line-height:1.35; color:var(--text-main); font-weight:${view.isRead ? '600' : '700'};">${escapeHtml(view.title)}</h2>
                                <span class="notification-read-state" style="font-size:11px; font-weight:700; white-space:nowrap; color:${view.isRead ? 'var(--text-muted)' : 'var(--primary)'}; background:${view.isRead ? 'var(--bg-main)' : 'color-mix(in srgb, var(--primary) 10%, transparent)'}; padding:3px 8px; border-radius:100px;">${view.isRead ? 'Lue' : 'Non lue'}</span>
                            </div>
                            <p class="notification-body-text" style="margin:6px 0 0; font-size:14px; line-height:1.5; color:var(--text-main); font-weight:400;">${bodyText}</p>
                            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:9px; font-size:12px; color:var(--text-light);">
                                <span class="notification-type" style="display:inline-flex; align-items:center; gap:4px;"><i class="material-icons-round" style="font-size:14px;" aria-hidden="true">label</i>${escapeHtml(meta.label)}</span>
                                <span aria-hidden="true">•</span>
                                <time class="notification-date"${view.date.iso ? ` datetime="${escapeHtml(view.date.iso)}"` : ''}>${escapeHtml(view.date.label)}</time>
                            </div>
                        </div>
                        ${!view.isRead ? '<div class="notification-unread-dot" aria-hidden="true" style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary); align-self: center; flex-shrink: 0;"></div>' : ''}
                    </div>
                    ${contactBlock}
                </article>`;
            }).join('');

            // Les CTA de contact conservent leur action propre sans ouvrir aussi le détail de l'envie.
            list.querySelectorAll('[data-notification-action]').forEach(action => {
                action.addEventListener('click', event => event.stopPropagation());
            });

            // Toute notification liée à une envie ouvre son détail, puis est marquée comme lue.
            list.querySelectorAll('.notification-item').forEach(item => {
                const activateNotification = async () => {
                    const notifId = item.dataset.notifId;
                    const isRead = item.dataset.isRead === 'true';
                    const notifType = item.dataset.notifType || '';
                    const desireId = item.dataset.desireId || '';
                    const navigation = getNotificationNavigation({
                        type: notifType,
                        related_desire_id: desireId,
                    });

                    if (navigation) {
                        window.dispatchEvent(new CustomEvent('view-desire', {
                            detail: { ...navigation, notificationType: notifType },
                            bubbles: true,
                            composed: true,
                        }));
                    }

                    if (isRead) return; // déjà lue
                    try {
                        const { api } = await import('../../api.js');
                        await api.markNotificationRead(notifId);
                        // Mise à jour visuelle immédiate
                        item.dataset.isRead = 'true';
                        item.classList.remove('unread');
                        item.style.background = 'var(--bg-card)';
                        item.style.border = '1px solid var(--border-light)';
                        item.setAttribute('aria-label', item.getAttribute('aria-label').replace('non lue', 'lue'));
                        const dot = item.querySelector('.notification-unread-dot');
                        if (dot) dot.remove();
                        const title = item.querySelector('.notification-title');
                        if (title) title.style.fontWeight = '600';
                        const readState = item.querySelector('.notification-read-state');
                        if (readState) {
                            readState.textContent = 'Lue';
                            readState.style.color = 'var(--text-muted)';
                            readState.style.background = 'var(--bg-main)';
                        }
                        // Rafraîchir le badge
                        window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
                    } catch (_) { }
                };

                item.addEventListener('click', activateNotification);
                item.addEventListener('keydown', event => {
                    if (event.target !== item) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    activateNotification();
                });
            });

            // Afficher "Voir plus" s'il reste des notifications à charger
            if (loadMoreWrap) {
                loadMoreWrap.style.display = (this._notifItems.length < this._notifTotal) ? 'block' : 'none';
            }
            if (voirPlusBtn) {
                voirPlusBtn.disabled = false;
                const lbl = voirPlusBtn.querySelector('.notifications-load-more-label');
                if (lbl) lbl.textContent = 'Voir plus';
            }
        } catch (err) {
            list.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Impossible de charger les notifications.</p>`;
            if (loadMoreWrap) loadMoreWrap.style.display = 'none';
            if (voirPlusBtn) {
                voirPlusBtn.disabled = false;
                const lbl = voirPlusBtn.querySelector('.notifications-load-more-label');
                if (lbl) lbl.textContent = 'Voir plus';
            }
        }
    }

    show() {
        this.querySelector('#notificationPage').style.display = 'block';
        this.loadNotifications();
        // Rafraîchir le badge après ouverture
        setTimeout(() => window.dispatchEvent(new CustomEvent('refresh-notif-badge')), 500);
    }

    hide() {
        this.querySelector('#notificationPage').style.display = 'none';
    }
}

customElements.define('app-notification-page', NotificationPage);
