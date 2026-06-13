// 1. IMPORTS CSS
import '../css/variables.css';
import '../css/base.css';
import '../css/layout.css';
import '../css/components.css';

// 2. IMPORT DU STORE GLOBAL
import { GlobalStore } from './store/GlobalStore.js';
import { api } from './api.js';
import { escapeHtml } from './utils/escapeHtml.js';
import * as sessionManager from './utils/sessionManager.js';
import { initFirebase } from './utils/firebaseConfig.js';

// Pages accessibles sans être connecté
const PUBLIC_PAGES = new Set(['home', 'search', 'results', 'login', 'register', 'forgot-password', 'reset-password']);

// 3. IMPORT DES WEB COMPONENTS
// Ces imports enregistrent les Custom Elements via customElements.define()
import './components/ui/DesireCard.js';
import './components/ui/FilterPill.js';
import './components/ui/FilterModal.js';
import './components/layout/Navbar.js';
import './components/layout/ResultsHeader.js';
import './components/layout/ExplorationSection.js';
import './components/layout/ResultsContent.js';
import './components/search/HomeHero.js';
import './components/pages/SearchPage.js';
import './components/pages/NotificationPage.js';
import './components/pages/CreationPage.js';
import './components/pages/ProfilePage.js';
import './components/pages/DesireDetailsPage.js';
import './components/pages/LoginPage.js';
import './components/pages/RegisterPage.js';
import './components/pages/ForgotPasswordPage.js';
import './components/pages/ResetPasswordPage.js';
import './components/pages/BoostPage.js';
import './components/pages/BoostDetailsPage.js';

/* ---------------------------------------------------------------
   4. THÈME — mode clair uniquement
   --------------------------------------------------------------- */
document.documentElement.setAttribute('data-theme', 'light');
localStorage.setItem('dystrax-theme', 'light');

/* ---------------------------------------------------------------
   5. STORE SUBSCRIPTIONS
   --------------------------------------------------------------- */
GlobalStore.subscribe('theme', (theme: string) => {
    const resolved = theme === 'dark' ? 'light' : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('dystrax-theme', resolved);
});
GlobalStore.setState('theme', 'light');

/* ---------------------------------------------------------------
   5. NAVIGATION SPA
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    
    // Initialiser Firebase (si configuré)
    initFirebase();

    const get = <T extends HTMLElement>(selector: string) =>
        document.querySelector(selector) as T | null;

    const homeHero = get('app-home-hero');
    const explorationSection = get('app-exploration-section');
    const navbar = get<HTMLElement>('app-navbar');
    const resultsContent = get('app-results-content');
    const searchPage = get<any>('app-search-page');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notificationPage = get<any>('app-notification-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creationPage = get<any>('app-creation-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilePage = get<any>('app-profile-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const desireDetailsPage = get<any>('app-desire-details');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loginPage = get<any>('app-login-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registerPage = get<any>('app-register-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forgotPasswordPage = get<any>('app-forgot-password-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resetPasswordPage = get<any>('app-reset-password-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boostPage = get<any>('app-boost-page');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boostDetailsPage = get<any>('app-boost-details-page');

    // --- Overlay de transition entre pages ---
    const transitionOverlay = document.createElement('div');
    transitionOverlay.id = 'page-transition-overlay';
    transitionOverlay.innerHTML = `<div class="page-loader-ring"></div>`;
    document.body.appendChild(transitionOverlay);

    // --- Système Toast global ---
    const toastEl = document.createElement('div');
    toastEl.id = 'global-toast';
    toastEl.style.cssText = [
        'position: fixed', 'top: 20px', 'left: 50%', 'transform: translateX(-50%) translateY(-20px)',
        'background: var(--text-main)', 'color: var(--bg-main)',
        'padding: 12px 20px', 'border-radius: 100px',
        'font-size: 14px', 'font-weight: 600',
        'box-shadow: 0 4px 20px rgba(0,0,0,0.2)',
        'z-index: 9999', 'opacity: 0',
        'transition: opacity 0.25s, transform 0.25s',
        'pointer-events: none', 'white-space: nowrap',
        'display: flex', 'align-items: center', 'gap: 8px'
    ].join(';');
    document.body.appendChild(toastEl);

    let _toastTimer: ReturnType<typeof setTimeout> | null = null;
    function showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
        if (_toastTimer) clearTimeout(_toastTimer);
        const icons: Record<string, string>  = { success: 'check_circle', info: 'info', error: 'error_outline' };
        const bgColors: Record<string, string> = { success: '#10b981', info: '#6366f1', error: '#ef4444' };
        toastEl.style.background = bgColors[type] || bgColors.success;
        toastEl.style.color = '#fff';
        toastEl.innerHTML = `<i class="material-icons-round" style="font-size: 18px;">${icons[type]}</i> ${escapeHtml(message)}`;
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateX(-50%) translateY(0)';
        _toastTimer = setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateX(-50%) translateY(-20px)';
        }, 3000);
    }

    // Écouter l'événement show-toast émis par les composants
    window.addEventListener('show-toast', (e) => {
        const { message, type } = (e as CustomEvent).detail || {};
        if (message) showToast(message, type || 'success');
    });

    function show(el: HTMLElement | null) { if (el) el.style.display = 'block'; }
    function hide(el: HTMLElement | null) { if (el) el.style.display = 'none'; }

    let _currentPageId = 'home';
    let _pendingBoostData: { desireId?: string; desireTitle?: string } | null = null;

    function _doNavigate(pageId: string) {
        // Tout masquer
        hide(homeHero);
        hide(explorationSection);
        hide(resultsContent);
        document.body.classList.remove('state-results');
        if (searchPage?.hide) searchPage.hide();
        if (notificationPage?.hide) notificationPage.hide();
        if (creationPage?.hide) creationPage.hide();
        if (profilePage?.hide) profilePage.hide();
        if (loginPage?.hide) loginPage.hide();
        if (registerPage?.hide) registerPage.hide();
        if (forgotPasswordPage?.hide) forgotPasswordPage.hide();
        if (resetPasswordPage?.hide) resetPasswordPage.hide();
        if (boostPage?.hide) boostPage.hide();

        // Afficher la page demandée
        switch (pageId) {
            case 'home':
                show(homeHero);
                show(explorationSection);
                hide(resultsContent); // résultats cachés jusqu'à une recherche explicite
                // Vider les résultats précédents pour ne pas les voir réapparaître
                if ((resultsContent as any)?.clearResults) (resultsContent as any).clearResults();
                if (navbar) navbar.style.display = (desireDetailsPage as any)?.isOpen?.() ? 'none' : 'flex';
                // eslint-disable-next-line no-case-declarations
                const homeBtn = navbar?.querySelector('.nav-btn[title="Accueil"]');
                if (homeBtn) {
                    navbar?.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                    homeBtn.classList.add('active');
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (homeHero as any)?.deactivateSearch === 'function') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (homeHero as any).deactivateSearch(true);
                }
                // Actualiser l'explorateur et le badge des notifications
                const explSection = document.querySelector('app-exploration-section') as any;
                if (explSection) {
                    explSection._loading = false;
                    explSection.loadDesires?.();
                }
                window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
                break;
            case 'search':
                hide(homeHero);
                hide(explorationSection);
                hide(resultsContent);
                hide(navbar);
                if (searchPage?.show) searchPage.show();
                break;
            case 'results':
                show(homeHero);
                show(explorationSection);
                show(resultsContent);
                document.body.classList.add('state-results');
                hide(navbar);
                break;
            case 'notifications':
                hide(navbar);
                if (notificationPage?.show) notificationPage.show();
                break;
            case 'creation':
                hide(navbar);
                if (creationPage?.show) creationPage.show();
                break;
            case 'profile':
                hide(navbar);
                if (profilePage?.show) profilePage.show();
                break;
            case 'login':
                hide(navbar);
                if (loginPage?.show) loginPage.show();
                break;
            case 'register':
                hide(navbar);
                if (registerPage?.show) registerPage.show();
                break;
            case 'forgot-password':
                hide(navbar);
                if (forgotPasswordPage?.show) forgotPasswordPage.show();
                break;
            case 'reset-password':
                hide(navbar);
                if (resetPasswordPage?.show) resetPasswordPage.show();
                break;
            case 'boost':
                hide(navbar);
                if (boostPage?.open) boostPage.open(_pendingBoostData || {});
                _pendingBoostData = null;
                break;
        }

        _currentPageId = pageId;
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }

    // navigateTo : affiche un overlay de chargement, puis navigue
    let _isNavigating = false;
    function navigateTo(pageId: string, pushState = true) {
        if (_isNavigating) return;

        // Auth guard en cours de navigation
        if (!PUBLIC_PAGES.has(pageId) && !api.isAuthenticated()) {
            pageId = 'login';
        }

        if (pushState) {
            history.pushState({ page: pageId }, '', `#${pageId}`);
        }

        // Si retour home sans animation (première nav), naviguer direct
        const isFirstNav = !document.body.dataset.firstNav;
        if (isFirstNav) {
            document.body.dataset.firstNav = '1';
            _doNavigate(pageId);
            return;
        }

        // Afficher l'overlay de transition
        _isNavigating = true;
        transitionOverlay.classList.add('visible');

        setTimeout(() => {
            _doNavigate(pageId);
            // Masquer l'overlay
            setTimeout(() => {
                transitionOverlay.classList.remove('visible');
                _isNavigating = false;
            }, 220);
        }, 200);
    }

    // Bouton retour du téléphone : si l'overlay détail est ouvert, le fermer (on a poussé un état à l'ouverture)
    window.addEventListener('popstate', (e) => {
        if ((desireDetailsPage as any)?.isOpen?.()) {
            (desireDetailsPage as any).close();
            return;
        }
        if (_currentPageId === 'login' || _currentPageId === 'register' || _currentPageId === 'creation' || _currentPageId === 'profile' || _currentPageId === 'notifications') {
            history.replaceState({ page: 'home' }, '', '#home');
            navigateTo('home', false);
            return;
        }
        
        if (_currentPageId === 'forgot-password' || _currentPageId === 'reset-password') {
            history.replaceState({ page: 'login' }, '', '#login');
            navigateTo('login', false);
            return;
        }
        navigateTo(e.state?.page || 'home', false);
    });

    // Initialisation — attendre que les WC soient enregistrés
    const hashRaw = window.location.hash.replace('#', '') || 'home';
    const initialHash = hashRaw.split('?')[0] || hashRaw;
    history.replaceState({ page: initialHash }, '', window.location.hash || '#home');
    _currentPageId = initialHash || 'home';

    // Lien partagé : #desire/<uuid> → page publique, ouvre l'overlay de détails
    const _desireLinkMatch = initialHash.match(/^desire\/([0-9a-f-]{36})$/i);
    const _desireIdFromLink = _desireLinkMatch ? _desireLinkMatch[1] : null;

    customElements.whenDefined('app-home-hero').then(() => {
        // ── Auth guard ──────────────────────────────────────────
        // Les liens de partage desire/<id> sont publics (pas besoin d'être connecté pour voir)
        const isPublic = PUBLIC_PAGES.has(initialHash) || !!_desireIdFromLink;
        const targetPage = isPublic
            ? (_desireIdFromLink ? 'home' : initialHash)
            : (api.isAuthenticated() ? initialHash : 'login');
        navigateTo(targetPage, false);
        if (_desireIdFromLink) {
            history.replaceState({ page: 'home' }, '', '#home');
        }
        if (api.isAuthenticated()) {
            sessionManager.start(); // déjà connecté → démarrer le timer
        }

        // Ouvrir l'overlay de détails si c'est un lien partagé (et pousser un état pour que "retour" ferme l'overlay)
        if (_desireIdFromLink) {
            setTimeout(() => {
                history.pushState({ page: 'home', overlay: true }, '', '#home');
                desireDetailsPage?.open?.({ id: _desireIdFromLink });
            }, 150);
        }

        // Précharger les feature flags dès le démarrage pour des vérifications synchrones ultérieures
        import('./utils/featureFlags.js').then(({ preloadFeatureFlags }) => {
            preloadFeatureFlags().then(() => {
                // Masquer les boutons boost si la feature est désactivée
                import('./utils/featureFlags.js').then(({ syncIsEnabled }) => {
                    if (syncIsEnabled('boost_activate') === false) {
                        document.querySelectorAll('.boost-inline-btn, .boost-cta-btn').forEach(btn => {
                            (btn as HTMLElement).style.display = 'none';
                        });
                    }
                });
            });
        });
        // ────────────────────────────────────────────────────────
    });

    // Helper : navigue vers une page protégée si connecté, sinon vers login
    function guardedNavigate(page: string) {
        if (api.isAuthenticated()) {
            navigateTo(page);
        } else {
            navigateTo('login');
        }
    }

    // Événements de navigation émis par les composants
    window.addEventListener('navigate-home', () => navigateTo('home'));
    window.addEventListener('navigate-search', () => navigateTo('search'));
    window.addEventListener('navigate-notifications', () => guardedNavigate('notifications'));
    window.addEventListener('navigate-creation', () => guardedNavigate('creation'));
    window.addEventListener('navigate-profile', () => guardedNavigate('profile'));
    window.addEventListener('navigate-login', () => navigateTo('login'));   // public
    window.addEventListener('navigate-register', () => navigateTo('register')); // public
    window.addEventListener('navigate-forgot-password', () => navigateTo('forgot-password'));
    window.addEventListener('navigate-reset-password', () => navigateTo('reset-password'));
    window.addEventListener('auth-required', () => {
        if (_currentPageId !== 'login') navigateTo('login');
    });
    window.addEventListener('navigate-boost', async (e) => {
        try {
            const { isFeatureEnabled } = await import('./utils/featureFlags.js');
            if (!await isFeatureEnabled('boost_activate')) return; // bouton ne devrait pas être visible
        } catch { /* fail-open */ }
        _pendingBoostData = (e as CustomEvent).detail || null;
        guardedNavigate('boost');
    });
    window.addEventListener('create-desire', () => guardedNavigate('creation'));

    // 'view-boost-details' = clic sur "Boost en cours" → ouvre l'overlay de détails
    window.addEventListener('view-boost-details', (e) => {
        const { desireId, desireTitle } = (e as CustomEvent).detail || {};
        if (boostDetailsPage?.open) boostDetailsPage.open({ desireId, desireTitle });
    });

    // Après connexion / inscription : démarrer la session + recharger l'exploration
    window.addEventListener('user-logged-in', () => {
        sessionManager.start(); // démarre le timer d'inactivité
        const expl = document.querySelector('app-exploration-section') as any;
        if (expl) {
            expl._loading = false;
            expl.loadDesires?.();
        }
        window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
    });

    // Déconnexion après inactivité : naviguer vers login avec pré-remplissage
    window.addEventListener('session-expired', (e) => {
        const { phone } = (e as CustomEvent).detail || {};
        navigateTo('login');
        setTimeout(() => {
            if (loginPage?.show) loginPage.show({ prefillPhone: phone });
        }, 150);
    });

    // Rafraîchir l'explorateur (ex: après création d'une envie)
    window.addEventListener('refresh-explorer', () => {
        const expl = document.querySelector('app-exploration-section') as any;
        if (expl) {
            expl._loading = false;
            expl.loadDesires?.();
        }
    });

    window.addEventListener('navigate-create', (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail && detail.editMode && creationPage) {
            (creationPage as any)._pendingEdit = detail;
        }
        guardedNavigate('creation');
    });

    window.addEventListener('navigate-back', () => {
        if ((desireDetailsPage as any)?.isOpen?.()) {
            (desireDetailsPage as any).close();
            return;
        }
        if (_currentPageId === 'profile' || _currentPageId === 'notifications') {
            navigateTo('home');
            return;
        }
        if (window.history.length > 1) window.history.back();
        else navigateTo('home');
    });

    // Après fermeture de l'overlay détail : afficher la navbar seulement si on est sur l'accueil
    window.addEventListener('desire-detail-closed', () => {
        if (navbar) {
            navbar.style.display = _currentPageId === 'home' ? 'flex' : 'none';
        }
        window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
    });

    // Recherche
    window.addEventListener('recherche-validee', (e) => {
        const query = (e as CustomEvent).detail?.query;
        console.log('Recherche reçue :', query);
        navigateTo('results');

        if (resultsContent) {
            (resultsContent as any).setQuery?.(query);
        }
    });

    // Filtres (modale, recherche catégories…) — émis sur document dans les composants
    document.addEventListener('apply-filters', (e) => {
        const detail = (e as CustomEvent).detail || {};
        document.body.classList.add('state-results');
        navigateTo('results');
        if (resultsContent && (resultsContent as any).setQueryAndFilters) {
            (resultsContent as any).setQueryAndFilters(detail.query || '', {
                commune: detail.commune,
                price_type: detail.price_type,
                category: detail.category
            });
        }
        setTimeout(() => explorationSection?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    window.addEventListener('scroll-to-explore', () => {
        explorationSection?.scrollIntoView({ behavior: 'smooth' });
    });

    window.addEventListener('view-desire', (e) => {
        desireDetailsPage?.open?.((e as CustomEvent).detail);
        // Pousser un état pour que le 1er retour ferme l'overlay et le 2e retour aille à la page précédente
        history.pushState({ page: _currentPageId, overlay: true }, '', `#${_currentPageId}`);
    });

    // 'desire-view' = simple visualisation (bouton Voir sur cartes owner/joined) — PAS de toast
    window.addEventListener('desire-view', (e) => {
        desireDetailsPage?.open?.((e as CustomEvent).detail);
        history.pushState({ page: _currentPageId, overlay: true }, '', `#${_currentPageId}`);
    });

    // 'profile-refresh' = quitter une envie depuis une carte → mettre à jour le profil
    window.addEventListener('profile-refresh', () => {
        const pp = document.querySelector('app-profile-page') as any;
        if (pp?.loadProfile) pp.loadProfile();
    });

    // ── Confirmation quand un utilisateur rejoint une envie ──────
    window.addEventListener('desire-joined', (e) => {
        const { desireId } = (e as CustomEvent).detail || {};
        showToast('Vous avez rejoint cette envie !', 'success');

        // Mettre à jour la carte dans l'exploration / résultats sans recharger
        if (desireId) {
            document.querySelectorAll('desire-card').forEach((card) => {
                const htmlCard = card as HTMLElement;
                const cardId = htmlCard.dataset?.desireId || card.getAttribute('desire-id');
                if (cardId === String(desireId) && card.getAttribute('mode') !== 'owner') {
                    card.setAttribute('mode', 'pending');
                }
            });
        }

        // Rafraîchir le badge de notifications (le créateur va recevoir une notif)
        window.dispatchEvent(new CustomEvent('refresh-notif-badge'));
        // Rafraîchir la page de notifs si elle est ouverte
        const notifPage = document.querySelector('app-notification-page') as any;
        if (notifPage?.loadNotifications) notifPage.loadNotifications();
    });

    window.addEventListener('filter-toggled', (e) => {
        console.log('Filter toggled:', (e as CustomEvent).detail);
    });
});
