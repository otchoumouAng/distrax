import { escapeHtml, safeUrl, DEFAULT_AVATAR_PATH, DEFAULT_AVATAR_DATA_URI } from '../../utils/escapeHtml.js';
import { resolveImageUrl, getImageVariantUrl } from '../../utils/imageUrl.js';
import { formatSpotsLabel } from '../../utils/formatSpots.js';
import {
    createLikeController,
    handleLikeButtonClick,
    isLikeDisabled,
    parseLikeCount,
} from '../../utils/desireLikes.js';
import {
    REFUND_STATUS_LABELS,
    clearPendingPayment,
    formatAmount,
    formatDeadline,
    isPaidJourney,
    readPendingPayment,
    rememberPendingPayment,
    rememberReceiptTarget,
    rememberTicketTarget,
    resumePendingPayment,
} from '../../utils/paymentFlow.js';

export class DesireDetailsPage extends HTMLElement {
    constructor() {
        super();
        this.images = [];
        this.currentIndex = 0;
        this._desireId = null;  // ID de l'envie actuellement affichée
        this._isCreator = false; // si l'utilisateur est le créateur
        this._hasJoined = false; // si l'utilisateur a déjà rejoint
        this._isFull = false;    // si l'envie est complète
        this._isCancelled = false; // si l'activité a été annulée (NAV-06)
        this._isPast = false;      // si l'activité a déjà eu lieu (catalogue conservé)
        this._isAccepted = false;  // accepté, présence pas encore confirmée (PAR-08)
        this._isConfirmed = false; // présence confirmée (PAR-08)
        this._isRejected = false;  // participation refusée (footer masqué)
        // ── Parcours payant (PAR-01 à PAR-05) ───────────────────
        this._paidJourney = false;   // la plateforme encaisse le participant
        this._priceType = '';
        this._priceAmount = null;
        this._payMode = '';
        this._paymentPolicy = '';
        this._currency = 'XOF';
        this._eventEndAt = null;
        this._eventTimezone = null;
        this._bookingId = null;
        this._ticketId = null;
        this._paymentId = null;
        this._booking = null;        // dernière réservation lue côté serveur
        this._bookingStatus = '';    // confirmed | refund_due | cancelled | expired
        this._quote = null;          // devis affiché (prix total + échéance)
        this._pendingPayment = null; // paiement ouvert, en attente de vérification
        this._refund = null;         // suivi du remboursement (PAR-05)
        this._likeCount = 0;       // nombre de likes de l'envie affichée
        this._likedByMe = false;   // l'utilisateur a-t-il aimé cette envie
        this._desireStatus = '';   // statut du cycle de vie (CAT-04)
        this._likeController = null; // contrôleur de like mémoïsé
        /** Position de scroll sauvegardée pour restaurer à la fermeture (body lock). */
        this._savedScrollY = 0;
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                .details-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    z-index: 999; display: none; opacity: 0; transition: opacity 0.3s;
                }
                .details-overlay.active { opacity: 1; }
                .details-page {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    width: 100%; max-width: 600px; margin: 0 auto;
                    background: var(--bg-main); z-index: 1000;
                    overflow-y: auto; overflow-x: hidden;
                    transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: none; flex-direction: column;
                    box-shadow: 0 0 40px rgba(0,0,0,0.1);
                }
                .details-page.active {
                    transform: translateX(0); display: flex;
                }
                .header-transparent {
                    position: absolute; top: 0; left: 0; width: 100%; z-index: 10;
                    padding: 16px; display: flex; justify-content: space-between; align-items: center;
                }
                .icon-btn {
                    width: 44px; height: 44px; border-radius: 50%; border: none;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
                    color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;
                }
                .hero-carousel {
                    width: 100%; height: 220px; position: relative;
                    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
                    scrollbar-width: none; -ms-overflow-style: none;
                    cursor: zoom-in; flex-shrink: 0;
                }
                .hero-carousel::-webkit-scrollbar { display: none; }
                .hero-slide {
                    /* Dimensions strictement fixes — jamais de déformation */
                    flex: 0 0 100%; width: 100%; height: 220px;
                    object-fit: cover; object-position: center;
                    scroll-snap-align: center; background-color: var(--bg-card);
                    flex-shrink: 0; user-select: none; display: block;
                }

                /* ── Lightbox fullscreen ────────────────────────────── */
                .lightbox {
                    display: none; position: fixed; inset: 0;
                    background: rgba(0,0,0,0.95); z-index: 9999;
                    flex-direction: column; align-items: center; justify-content: center;
                }
                .lightbox.active { display: flex; }
                .lightbox-close {
                    position: absolute; top: 16px; right: 16px;
                    background: rgba(255,255,255,0.15); border: none; color: white;
                    width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 20px; backdrop-filter: blur(8px);
                    transition: background 0.2s;
                }
                .lightbox-close:hover { background: rgba(255,255,255,0.25); }
                .lightbox-counter {
                    position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                    color: white; font-size: 14px; font-weight: 600;
                    background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 100px;
                    backdrop-filter: blur(8px);
                }
                .lightbox-track {
                    width: 100%; height: 100%;
                    display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
                    scrollbar-width: none; -ms-overflow-style: none;
                }
                .lightbox-track::-webkit-scrollbar { display: none; }
                .lightbox-slide {
                    flex: 0 0 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    scroll-snap-align: center;
                    padding: 60px 16px;
                    box-sizing: border-box;
                }
                .lightbox-slide img {
                    max-width: 100%; max-height: 100%;
                    object-fit: contain; border-radius: 8px;
                    user-select: none; pointer-events: none;
                }
                .lightbox-dots {
                    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
                    display: flex; gap: 6px;
                }
                .lightbox-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: rgba(255,255,255,0.4); transition: all 0.2s;
                }
                .lightbox-dot.active {
                    background: white; width: 18px; border-radius: 3px;
                }
                .thumbnails-container {
                    display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; scrollbar-width: none;
                    flex-shrink: 0; /* ne jamais comprimer ce container */
                    min-height: 84px; /* 60px image + 24px padding */
                    align-items: center;
                }
                .thumbnails-container::-webkit-scrollbar { display: none; }
                .thumbnail {
                    width: 60px; height: 60px; border-radius: 12px; object-fit: cover;
                    opacity: 0.5; cursor: pointer; transition: all 0.2s;
                    border: 2px solid transparent; flex-shrink: 0;
                }
                .thumbnail.active {
                    opacity: 1; border-color: var(--primary);
                }
                
                .details-body {
                    padding: 20px; padding-bottom: 24px;
                    flex: 1; display: flex; flex-direction: column; gap: 20px;
                }
                .details-title { font-size: 24px; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.3; }
                
                .meta-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;}
                .m-tag { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-card); border-radius: 100px; font-size: 13px; font-weight: 600; color: var(--text-muted); border: 1px solid var(--border-light); }
                .m-tag i { font-size: 16px; color: var(--text-main); }
                [data-theme="dark"] .m-tag { background: color-mix(in srgb, var(--text-main) 5%, transparent); }

                /* Informations pratiques : lieu exact + itinéraire (PAR-16) */
                .address-line { align-items: center; gap: 8px; margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-light); font-size: 13px; color: var(--text-main); }
                .address-line > i { font-size: 18px; color: var(--text-muted); flex-shrink: 0; }
                .address-line #dAddress { flex: 1; min-width: 0; line-height: 1.4; }
                .address-route-btn { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 6px 12px; border-radius: 100px; background: var(--primary); color: white; font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }
                .address-route-btn i { font-size: 15px; }
                [data-theme="dark"] .address-line { background: color-mix(in srgb, var(--text-main) 5%, transparent); }

                .host-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-light); }
                .host-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
                .host-info h4 { margin: 0; font-size: 15px; color: var(--text-main); }
                .host-info p { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
                
                .description-block {
                    color: var(--text-main); line-height: 1.7; font-size: 15px;
                    padding: 16px; background: var(--bg-card);
                    border-radius: 16px; border: 1px solid var(--border-light);
                }

                /* —— Section Intéressés (visible uniquement pour le créateur) —— */
                .participants-section {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                    background: var(--bg-card);
                    border-radius: 16px;
                    border: 1px solid var(--border-light);
                }
                .participants-section.visible { display: flex; }
                .participants-section-title {
                    font-size: 15px; font-weight: 700; color: var(--text-main);
                    display: flex; align-items: center; gap: 8px; margin: 0;
                }
                .participants-section-title i { color: var(--primary); }
                .participants-counters {
                    display: flex; gap: 8px; flex-wrap: wrap;
                }
                .participants-counter-chip {
                    font-size: 12px; font-weight: 600; padding: 3px 10px;
                    border-radius: 100px; display: flex; align-items: center; gap: 4px;
                }
                .participants-list { display: flex; flex-direction: column; gap: 10px; }
                .participant-item {
                    display: flex; align-items: center; gap: 12px;
                    padding: 10px 12px; border-radius: 12px;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                }
                .participant-avatar {
                    width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
                    background: var(--bg-card); flex-shrink: 0;
                }
                .participant-pseudo { font-size: 14px; font-weight: 600; color: var(--text-main); }
                .participants-empty { color: var(--text-muted); font-size: 14px; text-align: center; padding: 12px 0; }

                .details-footer {
                    /* sticky dans le flex-column du panneau scrollable */
                    position: sticky; bottom: 0;
                    width: 100%;
                    padding: 14px 24px; background: var(--glass-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    border-top: 1px solid var(--border-light); z-index: 100;
                    display: flex; flex-direction: column; gap: 10px;
                    box-sizing: border-box;
                    min-height: 80px;
                    margin-top: auto;
                }
                .footer-row {
                    display: flex; justify-content: space-between; align-items: center; gap: 16px;
                    width: 100%;
                }
                .price-info { display: flex; flex-direction: column; }
                .price-val { font-size: 18px; font-weight: 700; color: var(--text-main); }
                .price-sub { font-size: 12px; color: var(--text-muted); }

                /* Récapitulatif de paiement (PAR-01) */
                .payment-recap {
                    display: none; width: 100%; padding: 10px 12px;
                    border-radius: 12px; background: rgba(16, 185, 129, 0.06);
                    border: 1px solid rgba(16, 185, 129, 0.22);
                    box-sizing: border-box;
                }
                .payment-recap-row {
                    display: flex; justify-content: space-between; align-items: baseline;
                    font-size: 12px; color: var(--text-muted); padding: 2px 0;
                }
                .payment-recap-row strong { font-size: 13px; color: var(--text-main); }
                .payment-recap-note {
                    font-size: 11px; line-height: 1.4; color: var(--text-muted);
                    margin-top: 6px;
                }
                .payment-recap-actions {
                    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px;
                }
                .payment-recap-link {
                    border: none; background: none; padding: 0; cursor: pointer;
                    font-size: 12px; font-weight: 600; color: var(--primary);
                    text-decoration: underline; font-family: inherit;
                }
                .payment-recap-link.danger { color: #dc2626; }
                .payment-recap-link:disabled { opacity: .5; cursor: default; }

                .join-action-btn {
                    /* taille auto — ne s'étire pas */
                    flex: 0 0 auto;
                    height: 44px;
                    padding: 0 24px; border-radius: 100px;
                    border: none;
                    background: var(--primary);
                    color: white; font-weight: 600; font-size: 13px; cursor: pointer;
                    box-shadow: 0 2px 10px color-mix(in srgb, var(--primary) 30%, transparent);
                    transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.15s;
                    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                    letter-spacing: 0.02em; white-space: nowrap;
                }
                .join-action-btn:hover {
                    opacity: 0.9;
                    box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 40%, transparent);
                    transform: translateY(-1px);
                }
                .join-action-btn:active { transform: scale(0.97); opacity: 1; }
                .join-action-btn.joined {
                    background: rgba(239, 68, 68, 0.1);
                    border: none;
                    color: #ef4444;
                    box-shadow: none;
                    font-size: 13px;
                    font-weight: 600;
                }
                .join-action-btn.joined:hover {
                    background: rgba(239, 68, 68, 0.15);
                    opacity: 1;
                }
                .join-action-btn.creator-badge {
                    background: linear-gradient(135deg, #f59e0b, #f97316);
                    box-shadow: 0 2px 10px rgba(245,158,11,0.25);
                    cursor: default;
                    pointer-events: none;
                    font-size: 13px;
                }

                /* —— Bouton Inviter (créateur) : partage un lien qui met en avant « Rejoindre » —— */
                .invite-action-btn {
                    flex: 0 0 auto;
                    height: 44px; padding: 0 18px;
                    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                    border: none; border-radius: 100px;
                    background: color-mix(in srgb, var(--primary) 12%, transparent);
                    color: var(--primary);
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    white-space: nowrap;
                    transition: transform 0.15s ease, background 0.2s ease;
                }
                .invite-action-btn .material-icons-round { font-size: 18px; }
                .invite-action-btn:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }
                .invite-action-btn:active { transform: scale(0.97); }

                /* —— Bouton Like ♥ (pied de page) —— */
                .footer-actions { display: flex; align-items: center; gap: 10px; }
                .details-like-btn {
                    flex: 0 0 auto;
                    height: 44px; padding: 0 10px;
                    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    white-space: nowrap; line-height: 1;
                    transition: transform 0.15s ease, color 0.2s ease;
                }
                .details-like-btn .material-icons-round { font-size: 20px; opacity: 0.9; }
                .details-like-btn .like-count { font-variant-numeric: tabular-nums; }
                .details-like-btn:hover {
                    color: #ef4444;
                }
                .details-like-btn:active { transform: scale(0.97); }
                /* État actif : cœur plein */
                .details-like-btn.is-active {
                    color: #ef4444;
                }
                .details-like-btn.is-active .material-icons-round { opacity: 1; }
                /* Activité passée ou statut terminal : plus d'interaction (CAT-04) */
                .details-like-btn:disabled,
                .details-like-btn:disabled:hover {
                    color: var(--text-muted);
                    background: transparent;
                    opacity: 0.55; cursor: default; transform: none;
                }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* —— État annulé (NAV-06) —— */
                .cancelled-banner {
                    display: none; flex-direction: column; gap: 10px;
                    padding: 16px; border-radius: 16px;
                    background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
                }
                [data-theme="dark"] .cancelled-banner {
                    background: color-mix(in srgb, #ef4444 14%, transparent);
                    border-color: color-mix(in srgb, #ef4444 40%, transparent);
                    color: #fca5a5;
                }
                .cancelled-banner-head { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
                .cancelled-banner-head i { font-size: 22px; }
                .cancelled-banner p { margin: 0; font-size: 13px; line-height: 1.5; }
                .cancelled-banner-btn {
                    align-self: flex-start; margin-top: 4px;
                    padding: 8px 16px; border-radius: 100px; border: none;
                    background: var(--primary); color: white;
                    font-size: 13px; font-weight: 600; cursor: pointer;
                }
                /* Variante neutre : activité passée, ce n'est pas une annulation. */
                .cancelled-banner.past-banner {
                    background: color-mix(in srgb, var(--text-muted) 10%, var(--bg-card));
                    border-color: var(--border-light);
                    color: var(--text-muted);
                }

                /* Mise en évidence des champs modifiés (NAV-05) */
                .field-changed {
                    animation: fieldPulse 1.2s ease-in-out 3;
                    border-radius: 100px;
                    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 60%, transparent);
                }
                /* Étape mise en avant à l'ouverture d'une notification (CDC §11) :
                   on attire l'œil sur l'action attendue sans jamais l'exécuter. */
                .cta-focus {
                    animation: fieldPulse 1.2s ease-in-out 3;
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 45%, transparent);
                }
                @keyframes fieldPulse {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: color-mix(in srgb, var(--primary) 22%, transparent); }
                }
            </style>
            <div class="details-overlay" id="detailsOverlay"></div>
            <div class="details-page" id="desireDetailsPage">
                <header class="header-transparent">
                    <button class="icon-btn back-btn" aria-label="Retour"><i class="material-icons-round">arrow_back</i></button>
                    <div style="display: flex; gap: 8px;">
                        <button class="icon-btn share-btn" aria-label="Partager"><i class="material-icons-round">share</i></button>
                        <button class="icon-btn save-btn" aria-label="Sauvegarder"><i class="material-icons-round">favorite_border</i></button>
                    </div>
                </header>

                <div class="hero-carousel" id="detailsHeroCarousel"></div>
                <div class="thumbnails-container" id="detailsThumbnails"></div>

                <div class="details-body">
                    <h1 class="details-title" id="dTitle">Atelier de poterie et création artisanale</h1>

                    <!-- État annulé (NAV-06) -->
                    <div class="cancelled-banner" id="dCancelledState">
                        <div class="cancelled-banner-head">
                            <i class="material-icons-round">event_busy</i>
                            <span>Activité annulée</span>
                        </div>
                        <p>L'organisateur a annulé cette envie. Découvre d'autres activités près de toi.</p>
                        <button class="cancelled-banner-btn" id="cancelledAlternativesBtn" type="button">Voir d'autres envies</button>
                    </div>

                    <!-- État passé : activité déjà terminée, inscriptions closes -->
                    <div class="cancelled-banner past-banner" id="dPastState">
                        <div class="cancelled-banner-head">
                            <i class="material-icons-round">history</i>
                            <span>Activité déjà passée</span>
                        </div>
                        <p>Cette activité a déjà eu lieu. Tu peux consulter son contenu, mais les inscriptions sont closes.</p>
                        <button class="cancelled-banner-btn" id="pastAlternativesBtn" type="button">Voir d'autres envies</button>
                    </div>

                    <!-- Maintien organisateur (ORG-08/09) : l'échéance approche,
                         l'organisateur confirme, modifie ou annule. -->
                    <div class="maintenance-strip" id="dMaintenanceStrip" style="display: none;">
                        <div class="maintenance-head"><i class="material-icons-round">event_available</i><span>Ton activité approche</span></div>
                        <p>Confirme qu'elle est maintenue afin de prévenir les participants.</p>
                        <div class="maintenance-actions">
                            <button class="maint-keep-btn" id="maintKeepBtn" type="button"><i class="material-icons-round">check</i> Maintenir</button>
                            <button class="maint-edit-btn" id="maintEditBtn" type="button"><i class="material-icons-round">edit</i> Modifier</button>
                            <button class="maint-cancel-btn" id="maintCancelBtn" type="button"><i class="material-icons-round">event_busy</i> Annuler</button>
                        </div>
                    </div>

                    <div class="meta-tags" id="dMeta">
                        <span class="m-tag"><i class="material-icons-round">location_on</i> <span id="dCommune">Plateau</span></span>
                        <span class="m-tag"><i class="material-icons-round">calendar_today</i> <span id="dDate">Samedi, 14:00</span></span>
                        <span class="m-tag"><i class="material-icons-round">group</i> <span id="dSpots">Reste 5 places</span></span>
                        <span class="m-tag" id="dViewCountWrap" style="display: none;"><i class="material-icons-round">visibility</i> <span id="dViewCountNum">0</span> vues</span>
                    </div>

                    <div class="address-line" id="dAddressWrap" style="display: none;">
                        <i class="material-icons-round">place</i>
                        <span id="dAddress"></span>
                        <a class="address-route-btn" id="dItinerary" href="#" target="_blank" rel="noopener" aria-label="Ouvrir l'itinéraire">
                            <i class="material-icons-round">directions</i>
                            <span>Itinéraire</span>
                        </a>
                    </div>

                    <div class="host-card">
                        <img src="" id="dAvatar" class="host-avatar" alt="Hôte" data-fallback-avatar="${escapeHtml(DEFAULT_AVATAR_DATA_URI)}" onerror="this.onerror=null;this.src=this.getAttribute('data-fallback-avatar')">
                        <div class="host-info">
                            <h4 id="dAuthor">Alice B.</h4>
                            <p>Organisateur (Il y a <span id="dTime">3 heures</span>)</p>
                        </div>
                    </div>

                    <div class="description-block" id="dDescription">
                        Aucune description fournie.
                    </div>

                    <!-- Section intéressés (créateur uniquement) -->
                    <div class="participants-section" id="participantsSection">
                        <h3 class="participants-section-title">
                            <i class="material-icons-round">favorite_border</i>
                            Intéressés
                            <span id="participantsBadge" style="background: var(--primary); color: white; font-size: 12px; padding: 2px 8px; border-radius: 100px; margin-left: 4px;">0</span>
                        </h3>
                        <!-- Compteurs accepté/refusé -->
                        <div class="participants-counters" id="participantsCounters" style="display:none;">
                            <span class="participants-counter-chip" id="counterAccepted" style="background:#d1fae5; color:#059669;">
                                <i class="material-icons-round" style="font-size:13px;">check_circle</i>
                                <span id="countAccepted">0</span> Accepté(s)
                            </span>
                            <span class="participants-counter-chip" id="counterRejected" style="background:#fee2e2; color:#ef4444;">
                                <i class="material-icons-round" style="font-size:13px;">cancel</i>
                                <span id="countRejected">0</span> Refusé(s)
                            </span>
                        </div>
                        <div class="participants-list" id="participantsList">
                            <p class="participants-empty">Chargement…</p>
                        </div>
                    </div>
                </div>

                <div class="details-footer">
                    <div class="payment-recap" id="dPaymentRecap"></div>
                    <div class="footer-row">
                        <div class="price-info">
                            <span class="price-val" id="dPrice">15 000 FCFA</span>
                            <span class="price-sub" id="dPriceSub">Par personne</span>
                        </div>
                        <div class="footer-actions">
                            <button class="invite-action-btn" id="inviteActionBtn" type="button"
                                    aria-label="Inviter des proches à rejoindre cette envie"
                                    title="Inviter des proches à rejoindre" style="display: none;">
                                <i class="material-icons-round">person_add</i>
                                <span>Inviter</span>
                            </button>
                            <button class="details-like-btn" id="likeActionBtn" type="button"
                                    aria-pressed="false" aria-label="Aimer cette envie" title="Aimer cette envie">
                                <i class="material-icons-round">favorite_border</i>
                                <span class="like-count" id="likeCount">0</span>
                            </button>
                            <button class="join-action-btn" id="joinActionBtn">Rejoindre</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupListeners();

        // Rester synchrone si une carte a modifié le like de l'envie affichée.
        this._onLikeChanged = (event) => {
            const detail = event?.detail || {};
            if (!this._desireId || detail.desireId == null) return;
            if (String(detail.desireId) !== String(this._desireId)) return;
            this._likedByMe = detail.liked === true;
            this._likeCount = parseLikeCount(detail.likeCount);
            this._updateLikeButton();
        };
        window.addEventListener('desire-like-changed', this._onLikeChanged);
    }

    disconnectedCallback() {
        if (this._onLikeChanged) {
            window.removeEventListener('desire-like-changed', this._onLikeChanged);
        }
    }

    setupListeners() {
        const backBtn = this.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
            });
        }

        // ── Récapitulatif de paiement (PAR-01 / PAR-05) ─────────
        const paymentRecap = this.querySelector('#dPaymentRecap');
        if (paymentRecap) {
            paymentRecap.addEventListener('click', (event) => {
                const actionEl = event.target.closest('[data-payment-action]');
                if (!actionEl) return;
                const action = actionEl.dataset.paymentAction;
                if (action === 'receipt') this._openReceipt();
                else if (action === 'cancel') this._cancelPaidBooking(actionEl);
            });
        }

        const shareBtn = this.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this._handleShare());
        }

        // Créateur : inviter des proches via un lien qui met « Rejoindre » en avant.
        const inviteBtn = this.querySelector('#inviteActionBtn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => this._handleInvite());
        }

        // NAV-06 : depuis l'état annulé, proposer des envies alternatives.
        const alternativesBtn = this.querySelector('#cancelledAlternativesBtn');
        if (alternativesBtn) {
            alternativesBtn.addEventListener('click', () => {
                this.close();
                window.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }));
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('scroll-to-explore', { bubbles: true, composed: true }));
                }, 150);
            });
        }

        // Idem depuis l'état « activité déjà passée ».
        const pastAlternativesBtn = this.querySelector('#pastAlternativesBtn');
        if (pastAlternativesBtn) {
            pastAlternativesBtn.addEventListener('click', () => {
                this.close();
                window.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }));
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('scroll-to-explore', { bubbles: true, composed: true }));
                }, 150);
            });
        }

        // ── Maintien organisateur (ORG-08/09) ───────────────────
        const maintKeepBtn = this.querySelector('#maintKeepBtn');
        if (maintKeepBtn) {
            maintKeepBtn.addEventListener('click', async () => {
                if (!this._isCreator || !this._desireId) return;
                maintKeepBtn.disabled = true;
                try {
                    const { api } = await import('../../api.js');
                    await api.keepDesire(this._desireId);
                    this._needsMaintenance = false;
                    this._applyMaintenanceState({});
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Activité maintenue. Les participants sont prévenus.', type: 'success' } }));
                    window.dispatchEvent(new CustomEvent('profile-refresh'));
                } catch (err) {
                    maintKeepBtn.disabled = false;
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Erreur', type: 'error' } }));
                }
            });
        }

        const maintEditBtn = this.querySelector('#maintEditBtn');
        if (maintEditBtn) {
            maintEditBtn.addEventListener('click', () => {
                if (!this._isCreator || !this._desireId) return;
                this.close();
                window.dispatchEvent(new CustomEvent('navigate-create', {
                    detail: { editMode: true, desireId: this._desireId },
                    bubbles: true,
                    composed: true
                }));
            });
        }

        const maintCancelBtn = this.querySelector('#maintCancelBtn');
        if (maintCancelBtn) {
            maintCancelBtn.addEventListener('click', async () => {
                if (!this._isCreator || !this._desireId) return;
                const { showConfirm } = await import('../../utils/confirm.js');
                const ok = await showConfirm({
                    title: 'Annuler cette envie ?',
                    message: 'Les participants seront prévenus que l\'activité est annulée.',
                    confirmLabel: 'Oui, annuler',
                    cancelLabel: 'Retour',
                    type: 'danger',
                });
                if (!ok) return;

                maintCancelBtn.disabled = true;
                try {
                    const { api } = await import('../../api.js');
                    await api.updateDesire(this._desireId, { status: 'cancelled' });
                    this._isCancelled = true;
                    this._needsMaintenance = false;
                    this._applyMaintenanceState({});
                    const joinBtn = this.querySelector('#joinActionBtn');
                    this._updateJoinButton(joinBtn);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Activité annulée. Les participants sont prévenus.', type: 'info' } }));
                    window.dispatchEvent(new CustomEvent('profile-refresh'));
                } catch (err) {
                    maintCancelBtn.disabled = false;
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Erreur', type: 'error' } }));
                }
            });
        }

        const overlay = this.querySelector('#detailsOverlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
            });
        }

        const carousel = this.querySelector('#detailsHeroCarousel');
        if (carousel) {
            carousel.addEventListener('scroll', () => {
                if (carousel.offsetWidth === 0) return;
                const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
                if (index !== this.currentIndex) {
                    this.currentIndex = index;
                    this.updateThumbnails();
                }
            });
        }

        // ── Bouton Like ♥ (bascule optimiste) ──────────────────
        const likeBtn = this.querySelector('#likeActionBtn');
        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => handleLikeButtonClick(e, this._getLikeController()));
        }

        // ── Bouton Rejoindre / Quitter ─────────────────────────
        const joinBtn = this.querySelector('#joinActionBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', async () => {
                // Si créateur, le bouton est désactivé (CSS pointer-events: none)
                if (this._isCreator) return;

                const { api } = await import('../../api.js');

                if (!api.isAuthenticated()) {
                    joinBtn.textContent = 'Connectez-vous d\'abord';
                    joinBtn.style.background = '#ef4444';
                    setTimeout(() => {
                        joinBtn.textContent = 'Rejoindre';
                        joinBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                        this.close();
                        document.dispatchEvent(new CustomEvent('navigate-login', { bubbles: true, composed: true }));
                    }, 1500);
                    return;
                }

                const isLeaving = this._hasJoined;

                // ── Parcours payant (PAR-01 / PAR-02 / PAR-05) ────────
                // Aucun résultat n'est décidé ici : le paiement est ouvert chez
                // CinetPay puis vérifié côté serveur à la reprise.
                if (this._paidJourney) {
                    await this._handlePaidAction(joinBtn, api);
                    return;
                }

                // ── Confirmer la présence après acceptation (PAR-08) ──
                if (this._isAccepted && !this._isConfirmed) {
                    joinBtn.disabled = true;
                    joinBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite; vertical-align: middle;">autorenew</i> En cours...';
                    try {
                        await api.confirmPresence(this._desireId);
                        this._isConfirmed = true;
                        this._isAccepted = false;
                        joinBtn.disabled = false;
                        this._updateJoinButton(joinBtn);
                        window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { message: 'Votre présence est confirmée.', type: 'success' }
                        }));
                    } catch (err) {
                        joinBtn.disabled = false;
                        joinBtn.style.background = '#ef4444';
                        joinBtn.textContent = err.message || 'Erreur';
                        setTimeout(() => this._updateJoinButton(joinBtn), 2500);
                    }
                    return;
                }

                // Demander confirmation avant de quitter
                if (isLeaving) {
                    const { showConfirm } = await import('../../utils/confirm.js');
                    const ok = await showConfirm({
                        title: 'Quitter cette envie ?',
                        message: 'Vous serez retiré de la liste des participants. Cette action est réversible.',
                        confirmLabel: 'Oui, quitter',
                        cancelLabel: 'Annuler',
                        type: 'danger',
                    });
                    if (!ok) return;
                }

                const originalHTML = joinBtn.innerHTML;
                joinBtn.disabled = true;
                joinBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite; vertical-align: middle;">autorenew</i> En cours...';

                try {
                    if (isLeaving) {
                        // ── Quitter l'envie ──────────────────────────────
                        await api.leaveDesire(this._desireId);
                        this._hasJoined = false;
                        joinBtn.disabled = false;
                        this._updateJoinButton(joinBtn);
                        // Émettre un toast de confirmation
                        window.dispatchEvent(new CustomEvent('show-toast', {
                            detail: { message: 'Vous avez quitté cette envie.', type: 'info' }
                        }));
                    } else {
                        // ── Rejoindre l'envie ────────────────────────────
                        await api.joinDesire(this._desireId);
                        this._hasJoined = true;
                        joinBtn.disabled = false;
                        joinBtn.style.background = '#10b981';
                        joinBtn.innerHTML = '<i class="material-icons-round" style="vertical-align: middle;">check</i> Rejoint !';

                        // Émettre un événement de confirmation
                        window.dispatchEvent(new CustomEvent('desire-joined', {
                            detail: { desireId: this._desireId }
                        }));

                        // Demande contextuelle d'autorisation push (OPT-02)
                        import('../../utils/firebaseConfig.js')
                            .then(({ offerPushOptIn }) => offerPushOptIn('Sois averti dès que l\'organisateur répond à ta demande.'))
                            .catch(() => {});

                        setTimeout(() => {
                            this._updateJoinButton(joinBtn);
                            this.close();
                        }, 1200);
                    }
                } catch (err) {
                    joinBtn.disabled = false;
                    joinBtn.style.background = '#ef4444';
                    joinBtn.textContent = err.message || 'Erreur';
                    setTimeout(() => {
                        joinBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
                        joinBtn.innerHTML = originalHTML;
                    }, 2500);
                }
            });
        }
    }

    /** Met à jour visuellement le bouton selon l'état _hasJoined / _isCreator / _isAccepted / _isRejected */
    _updateJoinButton(btn) {
        btn = btn || this.querySelector('#joinActionBtn');
        if (!btn) return;

        btn.classList.remove('joined', 'creator-badge');
        btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
        // Réinitialiser ce que le cas « créateur » masque, pour éviter toute fuite
        // d'état lors d'une mise à jour ultérieure du même bouton.
        btn.style.display = '';
        const priceInfo = this.querySelector('.price-info');
        if (priceInfo) priceInfo.style.display = '';

        // Masquer la carte organisateur et le footer CTA si c'est le créateur
        const hostCard = this.querySelector('.host-card');
        if (hostCard) hostCard.style.display = this._isCreator ? 'none' : '';
        const footer = this.querySelector('.details-footer');

        // Le créateur ne rejoint pas sa propre envie : on lui propose d'inviter.
        const inviteBtn = this.querySelector('#inviteActionBtn');
        if (inviteBtn) inviteBtn.style.display = this._isCreator ? '' : 'none';

        // NAV-06 : une activité annulée n'offre plus aucune action d'inscription.
        const cancelledBanner = this.querySelector('#dCancelledState');
        if (this._isCancelled) {
            if (cancelledBanner) cancelledBanner.style.display = 'flex';
            if (footer) footer.style.display = 'none';
            return;
        }
        if (cancelledBanner) cancelledBanner.style.display = 'none';

        // Activité déjà passée : plus d'inscription possible, bandeau informatif.
        const pastBanner = this.querySelector('#dPastState');
        if (this._isPast) {
            if (pastBanner) pastBanner.style.display = 'flex';
            if (footer) footer.style.display = 'none';
            return;
        }
        if (pastBanner) pastBanner.style.display = 'none';

        if (this._isCreator) {
            // Le créateur ne s'inscrit pas à sa propre envie : on masque le prix et
            // l'inscription, mais on conserve le ♥ (aimer sa propre envie est autorisé,
            // simplement sans notification — PUS-10).
            if (priceInfo) priceInfo.style.display = 'none';
            btn.style.display = 'none';
            if (footer) footer.style.display = '';
        } else if (this._paidJourney && this._bookingStatus === 'confirmed') {
            // Participation payante confirmée : le billet est l'action principale (PAR-03).
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">confirmation_number</i> Voir mon billet';
        } else if (this._paidJourney && (this._bookingStatus === 'refund_due' || this._bookingStatus === 'cancelled')) {
            // Place libérée : plus aucune action d'inscription, le reçu reste lisible (PAR-05).
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'rgba(239, 68, 68, 0.1)';
            btn.style.color = '#b91c1c';
            btn.style.cursor = 'default';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = this._bookingStatus === 'cancelled'
                ? '<i class="material-icons-round" style="font-size:18px;">cancel</i> Participation annulée'
                : '<i class="material-icons-round" style="font-size:18px;">hourglass_bottom</i> Remboursement en cours';
        } else if (this._paidJourney && this._pendingPayment) {
            // Paiement ouvert : l'état reste « en attente » tant que le serveur n'a pas tranché.
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'linear-gradient(135deg, #f59e0b, #f97316)';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">hourglass_top</i> Vérifier le paiement';
        } else if (this._isFull) {
            // Envie complète : bouton désactivé
            if (footer) footer.style.display = '';
            btn.style.background = 'linear-gradient(135deg, #fef2f2, #fee2e2)';
            btn.style.color = '#dc2626';
            btn.style.cursor = 'default';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">block</i> Complet';
        } else if (this._isRejected) {
            // Refusé : masquer le footer, l'envie sera retirée de la liste
            if (footer) footer.style.display = 'none';
            // Retirer les cartes joined correspondantes dans le profil et l'exploration
            window.dispatchEvent(new CustomEvent('desire-rejected', { detail: { desireId: this._desireId } }));
        } else if (this._isConfirmed) {
            // Présence confirmée : information non-cliquable (PAR-08)
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.color = 'white';
            btn.style.cursor = 'default';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">verified</i> Présence confirmée';
        } else if (this._isAccepted) {
            // Accepté mais présence non confirmée : action demandée (PAR-08)
            if (footer) footer.style.display = '';
            btn.classList.remove('joined');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;">how_to_reg</i> Je confirme ma présence';
        } else if (this._hasJoined) {
            if (footer) footer.style.display = '';
            btn.classList.add('joined');
            btn.innerHTML = '<i class="material-icons-round" style="font-size: 16px;">close</i> Annuler';
        } else {
            if (footer) footer.style.display = '';
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
            btn.style.color = 'white';
            btn.innerHTML = this._paidJourney ? 'Payer et rejoindre' : 'Rejoindre';
        }
    }

    /* ── Parcours payant : paiement, billet, annulation (PAR-01 à PAR-05) ── */

    /**
     * Action du bouton principal pour une envie payante.
     * Aucun état n'est déduit du retour navigateur : seul `GET /payments/{id}`
     * (via la reprise) peut confirmer un paiement.
     */
    async _handlePaidAction(btn, api) {
        if (this._bookingStatus === 'confirmed' && this._bookingId) {
            this._openTicket();
            return;
        }
        if (this._bookingStatus === 'refund_due' || this._bookingStatus === 'cancelled') {
            return;
        }
        if (this._pendingPayment) {
            await this._verifyPendingPayment(btn);
            return;
        }
        await this._startPaidCheckout(btn, api);
    }

    /** Devis → réservation → tentative, puis redirection vers CinetPay. */
    async _startPaidCheckout(btn, api) {
        btn.disabled = true;
        btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;animation: spin 1s linear infinite;vertical-align:middle;">autorenew</i> Redirection…';
        try {
            const quote = await api.createPaymentQuote(this._desireId);
            this._quote = quote;
            this._renderPaymentRecap();

            const { confirmPaymentQuote } = await import('../ui/PaymentConfirmation.js');
            const confirmed = await confirmPaymentQuote({ quote,
                title: this.querySelector('#dTitle')?.textContent || 'Votre envie',
                location: this.querySelector('#dAddress')?.textContent || this.querySelector('#dCommune')?.textContent || '',
            });
            if (!confirmed) { btn.disabled = false; this._updateJoinButton(btn); return; }

            const booking = await api.createBooking(this._desireId, { quoteId: quote.id });
            this._bookingId = booking.id;
            this._bookingStatus = booking.status;

            const payment = await api.createPaymentAttempt(booking.id);
            if (!payment?.checkout_url) {
                throw new Error('Le lien de paiement est momentanément indisponible.');
            }

            // Mémorisé avant la sortie : au retour, la SPA revérifie l'état réel.
            rememberPendingPayment({
                paymentId: payment.id,
                bookingId: booking.id,
                desireId: this._desireId,
            });
            window.location.assign(payment.checkout_url);
        } catch (err) {
            btn.disabled = false;
            this._updateJoinButton(btn);
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: this._paymentErrorMessage(err), type: 'error' },
            }));
        }
    }

    /** Vérifie un paiement laissé en attente (retour CinetPay ou reconnexion). */
    async _verifyPendingPayment(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="material-icons-round" style="font-size:18px;animation: spin 1s linear infinite;vertical-align:middle;">autorenew</i> Vérification…';
        try {
            const outcome = await resumePendingPayment();
            if (outcome?.outcome === 'succeeded') {
                const { api } = await import('../../api.js');
                await this._resolveSucceededPayment(api, outcome.pending, outcome.payment);
            } else if (outcome?.outcome === 'failed') {
                this._pendingPayment = null;
                window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: { message: 'Le paiement a été refusé. Vous pouvez réessayer.', type: 'error' },
                }));
            } else {
                window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: { message: 'Paiement toujours en attente de confirmation.', type: 'info' },
                }));
            }
        } catch (err) {
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: this._paymentErrorMessage(err), type: 'error' },
            }));
        } finally {
            btn.disabled = false;
            this._renderPaymentRecap();
            this._updateJoinButton(btn);
        }
    }

    /** Appelé une fois le statut de participation connu. */
    async _loadPaidState(api) {
        if (!this._paidJourney) return;
        if (this._bookingStatus === 'confirmed'
            || this._bookingStatus === 'refund_due'
            || this._bookingStatus === 'cancelled') {
            await this._loadBookingState(api);
            return;
        }
        await this._checkPendingPayment(api);
    }

    /** Reprend le paiement mémorisé pour cette envie, sans jamais le supposer abouti. */
    async _checkPendingPayment(api) {
        const pending = readPendingPayment();
        if (!pending?.paymentId) return;
        if (pending.desireId && String(pending.desireId) !== String(this._desireId)) return;

        this._pendingPayment = pending;
        try {
            const payment = await api.getPayment(pending.paymentId);
            this._paymentId = payment.id;
            if (payment.booking_id) this._bookingId = payment.booking_id;

            if (payment.status === 'succeeded') {
                await this._resolveSucceededPayment(api, pending, payment);
            } else if (payment.status === 'failed') {
                clearPendingPayment({ paymentId: pending.paymentId });
                this._pendingPayment = null;
                window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: { message: 'Le paiement a été refusé. Vous pouvez réessayer.', type: 'error' },
                }));
            }
        } catch (err) {
            // Réseau indisponible : l'état « en attente » est conservé tel quel.
            console.warn('[DesireDetails] Vérification du paiement impossible:', err.message);
        }
        this._renderPaymentRecap();
    }

    async _resolveSucceededPayment(api, pending, payment) {
        clearPendingPayment({ paymentId: pending.paymentId });
        this._pendingPayment = null;
        this._bookingId = pending.bookingId || payment.booking_id || this._bookingId;
        this._paymentId = payment.id;
        await this._loadBookingState(api);
        if (!this._bookingStatus || this._bookingStatus === 'held') {
            this._bookingStatus = 'confirmed';
            this._hasJoined = true;
            this._ticketId = payment.ticket_id || this._ticketId;
        }
        window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: 'Paiement confirmé. Votre billet est disponible.', type: 'success' },
        }));
    }

    /** Relit la réservation : échéance d'annulation, billet et remboursement. */
    async _loadBookingState(api) {
        if (!this._bookingId) return;
        try {
            const booking = await api.getBooking(this._bookingId);
            this._booking = booking;
            this._bookingStatus = booking.status;
            this._ticketId = booking.ticket_id || this._ticketId;
            this._paymentId = booking.payment_id || this._paymentId;

            if (booking.refund_id) {
                try {
                    this._refund = await api.getRefund(booking.refund_id);
                } catch {
                    this._refund = null;
                }
            } else {
                this._refund = null;
            }

            if (booking.status === 'expired') {
                this._hasJoined = false;
            } else if (booking.status === 'confirmed') {
                this._hasJoined = true;
            }
            this._renderPaymentRecap();
        } catch (err) {
            console.warn('[DesireDetails] Réservation indisponible:', err.message);
        }
    }

    /** Récapitulatif : prix total, frais éventuels et limite d'annulation (PAR-01). */
    _renderPaymentRecap() {
        const recap = this.querySelector('#dPaymentRecap');
        if (!recap) return;

        if (!this._paidJourney) {
            recap.style.display = 'none';
            recap.innerHTML = '';
            return;
        }
        recap.style.display = 'block';

        const quote = this._quote;
        const booking = this._booking;
        const currency = quote?.currency || booking?.currency || this._currency || 'XOF';
        const total = quote?.total_amount ?? booking?.total_amount ?? this._priceAmount;
        const fee = Number(quote?.participant_fee || 0);
        const deadline = booking?.cancellation_deadline || quote?.cancellation_deadline || null;
        const cancelAllowed = booking
            ? (booking.allowed_actions || []).includes('cancel')
            : (quote ? quote.cancellation_available === true : null);

        const rows = [];
        if (total != null) {
            rows.push(`<div class="payment-recap-row"><span>Prix total</span><strong>${escapeHtml(formatAmount(total, currency))}</strong></div>`);
        }
        if (fee > 0) {
            rows.push(`<div class="payment-recap-row"><span>Frais de service</span><strong>${escapeHtml(formatAmount(fee, currency))}</strong></div>`);
        }

        let note;
        if (this._pendingPayment) {
            note = 'Paiement en attente de confirmation : le statut sera vérifié auprès du serveur.';
        } else if (this._bookingStatus === 'cancelled') {
            const refundLabel = REFUND_STATUS_LABELS[this._refund?.status] || 'Remboursement à suivre depuis votre profil';
            note = `Participation annulée. ${refundLabel}.`;
        } else if (this._bookingStatus === 'refund_due') {
            note = `${REFUND_STATUS_LABELS[this._refund?.status] || 'Remboursement en cours'}.`;
        } else if (deadline) {
            note = cancelAllowed === false
                ? `Annulation fermée depuis le ${formatDeadline(deadline)}.`
                : `Annulation possible jusqu'au ${formatDeadline(deadline)}.`;
        } else {
            note = 'La limite d\'annulation sera confirmée avant le paiement.';
        }

        const actions = [];
        if (this._paymentId && ['confirmed', 'cancelled', 'refund_due'].includes(this._bookingStatus)) {
            actions.push('<button type="button" class="payment-recap-link" data-payment-action="receipt">Voir le reçu</button>');
        }
        if (this._bookingStatus === 'confirmed' && cancelAllowed === true) {
            actions.push('<button type="button" class="payment-recap-link danger" data-payment-action="cancel">Annuler ma participation</button>');
        }

        recap.innerHTML = rows.join('')
            + `<div class="payment-recap-note">${escapeHtml(note)}</div>`
            + (actions.length ? `<div class="payment-recap-actions">${actions.join('')}</div>` : '');

        const priceEl = this.querySelector('#dPrice');
        const priceSub = this.querySelector('#dPriceSub');
        if (priceEl && total != null) priceEl.textContent = formatAmount(total, currency);
        if (priceSub) priceSub.textContent = 'Prix total';
    }

    /** Annulation et suivi du remboursement (PAR-05). */
    async _cancelPaidBooking(trigger) {
        if (!this._bookingId || this._bookingStatus !== 'confirmed') return;
        const { api } = await import('../../api.js');
        const { showConfirm } = await import('../../utils/confirm.js');
        const ok = await showConfirm({
            title: 'Annuler votre participation ?',
            message: 'Votre billet sera invalidé et votre place libérée. Le remboursement sera suivi depuis votre profil.',
            confirmLabel: 'Oui, annuler',
            cancelLabel: 'Garder ma place',
            type: 'danger',
        });
        if (!ok) return;

        trigger.disabled = true;
        try {
            const refund = await api.cancelBooking(this._bookingId);
            this._refund = refund;
            this._bookingStatus = 'cancelled';
            this._booking = {
                ...(this._booking || {}),
                status: 'cancelled',
                allowed_actions: ['view_receipt', 'report'],
                refund_id: refund.id,
            };
            this._ticketId = null;
            this._renderPaymentRecap();
            this._updateJoinButton();
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: {
                    message: `Participation annulée. ${REFUND_STATUS_LABELS[refund.status] || 'Remboursement en cours'}.`,
                    type: 'info',
                },
            }));
        } catch (err) {
            trigger.disabled = false;
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: this._paymentErrorMessage(err), type: 'error' },
            }));
        }
    }

    /** Ouvre le billet personnel (PAR-03/PAR-04) : le jeton n'est jamais reconstruit ici. */
    _openTicket() {
        if (!this._bookingId) return;
        rememberTicketTarget({ bookingId: this._bookingId, desireId: this._desireId });
        this.close();
        document.dispatchEvent(new CustomEvent('open-ticket', {
            bubbles: true,
            composed: true,
            detail: { bookingId: this._bookingId, desireId: this._desireId },
        }));
    }

    /** Ouvre le reçu stable du paiement (PAR-04). */
    _openReceipt() {
        if (!this._paymentId) return;
        rememberReceiptTarget(this._paymentId);
        this.close();
        document.dispatchEvent(new CustomEvent('open-receipt', {
            bubbles: true,
            composed: true,
            detail: { paymentId: this._paymentId },
        }));
    }

    /** Traduit les codes d'erreur financiers en message actionnable. */
    _paymentErrorMessage(err) {
        const code = err?.code || '';
        if (code === 'PAYMENTS_DISABLED' || code === 'PAYMENT_UNAVAILABLE') {
            return 'Le paiement en ligne n\'est pas encore activé.';
        }
        if (code === 'QUOTE_EXPIRED' || code === 'BOOKING_EXPIRED') {
            return 'La réservation a expiré. Relancez le paiement.';
        }
        if (code === 'IDEMPOTENCY_IN_PROGRESS') {
            return 'Une opération est déjà en cours. Réessayez dans un instant.';
        }
        if (code === 'IDEMPOTENCY_CONFLICT') {
            return 'Cette opération a déjà été enregistrée. Actualisez votre participation.';
        }
        if (code === 'CANCELLATION_CLOSED') {
            return 'L\'annulation n\'est plus possible pour cette participation.';
        }
        if (code === 'ALREADY_SCANNED') {
            return 'Ce billet a déjà été scanné ; l\'annulation n\'est plus possible.';
        }
        if (code === 'BOOKING_NOT_CANCELLABLE') {
            return 'Cette réservation ne peut pas être annulée.';
        }
        return err?.message || 'Une erreur est survenue. Réessayez.';
    }

    /** Contrôleur de like mémoïsé (bascule optimiste + réconciliation). */
    _getLikeController() {
        if (!this._likeController) {
            this._likeController = createLikeController({
                readState: () => ({
                    desireId: this._desireId,
                    liked: this._likedByMe,
                    likeCount: this._likeCount,
                }),
                writeState: (state) => {
                    this._likedByMe = state.liked === true;
                    this._likeCount = parseLikeCount(state.likeCount);
                    this._updateLikeButton();
                },
                onChange: (state) => this._emitLikeChanged(state),
                onError: () => {
                    window.dispatchEvent(new CustomEvent('show-toast', {
                        bubbles: true,
                        composed: true,
                        detail: { message: 'Impossible de mettre à jour le like. Réessaie.' },
                    }));
                },
                loadApi: async () => (await import('../../api.js')).api,
            });
        }
        return this._likeController;
    }

    /** Reflète l'état du like sur le bouton ♥ du pied de page. */
    _updateLikeButton() {
        const btn = this.querySelector('#likeActionBtn');
        if (!btn) return;

        const liked = this._likedByMe === true;
        const disabled = isLikeDisabled({
            mode: this._isPast ? 'past' : 'default',
            status: this._desireStatus,
        });
        const label = liked ? 'Retirer mon like' : 'Aimer cette envie';

        btn.classList.toggle('is-active', liked);
        btn.disabled = disabled;
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);

        const icon = btn.querySelector('.material-icons-round');
        if (icon) icon.textContent = liked ? 'favorite' : 'favorite_border';
        const count = btn.querySelector('.like-count');
        if (count) count.textContent = String(parseLikeCount(this._likeCount));
    }

    /** Notifie les autres vues (cartes) du changement de like. */
    _emitLikeChanged(state) {
        if (!this._desireId) return;
        this.dispatchEvent(new CustomEvent('desire-like-changed', {
            bubbles: true,
            composed: true,
            detail: {
                desireId: this._desireId,
                liked: state.liked === true,
                likeCount: parseLikeCount(state.likeCount),
            },
        }));
    }

    _formatDateDetail(iso) {
        if (!iso) return 'Date à confirmer';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    _formatPriceDetail(desire) {
        if (desire.price_type === 'free') return 'Gratuit';
        if (desire.price_type === 'contribution') return 'Contribution libre';
        const amount = desire.price_amount;
        return amount ? `${Number(amount).toLocaleString('fr-FR')} FCFA` : 'Payant';
    }

    async open(data) {
        const focus = data?.focus || null;
        const notificationType = data?.notificationType || null;
        // Normaliser l'ID — rejeter null / 'null' / undefined / vide
        const rawId = data.id || data.desireId || data.desire_id || null;
        this._desireId = (rawId && rawId !== 'null' && rawId !== 'undefined') ? rawId : null;
        if (!this._desireId) {
            console.warn('[DesireDetails] ID manquant dans le payload desire-view :', data);
        }
        this._isCreator = false;
        this._hasJoined = false;
        this._isFull = false;
        this._isCancelled = false;
        this._isRejected = false;
        this._isAccepted = false;
        this._isConfirmed = false;

        // ── Parcours payant (PAR-01 à PAR-05) : état remis à zéro ──
        this._paidJourney = false;
        this._priceType = '';
        this._priceAmount = null;
        this._payMode = '';
        this._paymentPolicy = '';
        this._currency = 'XOF';
        this._eventEndAt = null;
        this._eventTimezone = null;
        this._bookingId = null;
        this._ticketId = null;
        this._paymentId = null;
        this._booking = null;
        this._bookingStatus = '';
        this._quote = null;
        this._pendingPayment = null;
        this._refund = null;

        // Si on n'a que l'id (ex: après création, ou clic notif), charger les détails
        if (this._desireId && !data.title) {
            try {
                const { api } = await import('../../api.js');
                const full = await api.getDesire(this._desireId);
                const author = full.user?.pseudo ?? full.author_pseudo ?? full.author?.pseudo ?? 'Anonyme';
                const authorId = full.user?.id ?? full.author_id ?? full.author?.id ?? null;
                data = {
                    id: full.id,
                    desireId: full.id,
                    title: full.title,
                    author,
                    authorId,
                    timeAgo: 'À l\'instant',
                    commune: full.commune || 'Abidjan',
                    date: this._formatDateDetail(full.event_date),
                    spots: formatSpotsLabel(full.spots_taken, full.max_spots, full.is_unlimited),
                    price: this._formatPriceDetail(full),
                    avatar: resolveImageUrl(full.user?.avatar_url ?? full.author_avatar_url ?? full.author?.avatar_url) || DEFAULT_AVATAR_PATH,
                    images: full.images || [],
                    description: full.description || '',
                    view_count: full.view_count,
                    desireStatus: full.desire_status,
                    isPast: full.is_past === true,
                    needs_maintenance: full.needs_maintenance === true,
                    payment_policy: full.payment_policy,
                    price_type: full.price_type,
                    price_amount: full.price_amount,
                    pay_mode: full.pay_mode,
                    currency: full.currency,
                    event_end_at: full.event_end_at,
                    event_timezone: full.event_timezone,
                };
            } catch (err) {
                console.warn('[DesireDetails] Erreur chargement envie par id:', err);
            }
        }

        // La carte d'envie ne transporte pas les champs de paiement : les
        // compléter côté serveur pour distinguer une envie payante (PAR-01).
        if (this._desireId && data.payment_policy === undefined) {
            try {
                const { api } = await import('../../api.js');
                const full = await api.getDesire(this._desireId);
                data = {
                    ...data,
                    payment_policy: full.payment_policy,
                    price_type: full.price_type,
                    price_amount: full.price_amount,
                    pay_mode: full.pay_mode,
                    currency: full.currency,
                    event_end_at: full.event_end_at,
                    event_timezone: full.event_timezone,
                };
            } catch (err) {
                console.warn('[DesireDetails] Champs de paiement indisponibles:', err.message);
            }
        }

        // ── Éligibilité au parcours payant (PAR-01) ────────────
        this._priceType = data.price_type || '';
        this._priceAmount = data.price_amount ?? null;
        this._payMode = data.pay_mode || '';
        this._paymentPolicy = data.payment_policy || '';
        this._currency = data.currency || 'XOF';
        this._eventEndAt = data.event_end_at || null;
        this._eventTimezone = data.event_timezone || null;
        this._paidJourney = isPaidJourney({
            payment_policy: this._paymentPolicy,
            price_type: this._priceType,
            price_amount: this._priceAmount,
            pay_mode: this._payMode,
            currency: this._currency,
        });

        // NAV-06 : état annulé détecté depuis le cycle de vie de l'envie.
        this._isCancelled = data.desireStatus === 'cancelled';
        // Activité déjà passée : consultable mais non rejoignable.
        this._isPast = data.isPast === true || data.is_past === true;
        // ORG-08/09 : maintien à confirmer (organisateur, échéance proche).
        this._needsMaintenance = data.needs_maintenance === true;
        this._desireStatus = data.desireStatus || data.desire_status || '';

        // Like ♥ : état initial issu de la carte (likeCount/likedByMe) ou de l'API.
        this._likeCount = parseLikeCount(data.likeCount ?? data.like_count);
        this._likedByMe = (data.likedByMe ?? data.liked_by_me) === true;
        this._updateLikeButton();

        // Hydrate data
        this.querySelector('#dTitle').textContent = data.title || '';
        this.querySelector('#dAuthor').textContent = data.author || 'Anonyme';
        this.querySelector('#dTime').textContent = data.timeAgo || 'À l\'instant';
        this.querySelector('#dCommune').textContent = data.commune || '';
        this.querySelector('#dDate').textContent = data.date || '';
        const addressWrap = this.querySelector('#dAddressWrap');
        const addressEl = this.querySelector('#dAddress');
        if (addressWrap && addressEl) {
            const address = (data.address || '').trim();
            const commune = (data.commune || '').trim();
            // PAR-16 : le lieu exact peut se limiter à la commune ; l'itinéraire
            // reste proposé dès qu'une localisation est connue.
            const location = address || commune;
            addressEl.textContent = location;
            if (location) {
                const itinerary = this.querySelector('#dItinerary');
                if (itinerary) {
                    const query = encodeURIComponent([address, commune].filter(Boolean).join(', '));
                    itinerary.href = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
                }
                addressWrap.style.display = 'flex';
            } else {
                addressWrap.style.display = 'none';
            }
        }
        this.querySelector('#dSpots').textContent = data.spots || '';
        this.querySelector('#dPrice').textContent = data.price || 'Gratuit';
        const priceSub = this.querySelector('#dPriceSub');
        if (priceSub) priceSub.textContent = this._paidJourney ? 'Prix total' : 'Par personne';
        this._renderPaymentRecap();
        this.querySelector('#dAvatar').src = data.avatar || DEFAULT_AVATAR_PATH;
        const viewCountWrap = this.querySelector('#dViewCountWrap');
        const viewCountNum = this.querySelector('#dViewCountNum');
        if (viewCountWrap && viewCountNum) {
            if (data.view_count != null) {
                viewCountWrap.style.display = '';
                viewCountNum.textContent = Number(data.view_count).toLocaleString('fr-FR');
            } else {
                viewCountWrap.style.display = 'none';
            }
        }
        const desc = this.querySelector('#dDescription');
        if (desc) desc.textContent = data.description || 'Aucune description fournie pour cette envie.';

        this.images = (data.images || []).map(resolveImageUrl).filter(Boolean);
        this.currentIndex = 0;
        this.renderCarousel();

        const overlay = this.querySelector('#detailsOverlay');
        overlay.style.display = 'block';

        const page = this.querySelector('#desireDetailsPage');
        page.style.display = 'flex';

        // Force reflow
        void page.offsetWidth;

        page.classList.add('active');
        overlay.classList.add('active');

        // Verrouiller le scroll de la page : seule la page de détail doit être active
        this._savedScrollY = window.scrollY ?? window.pageYOffset ?? 0;
        const html = document.documentElement;
        html.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';

        if (this._desireId) {
            import('../../api.js').then(({ api }) => api.recordDesireView(this._desireId).catch(() => {}));
        }

        const navbar = document.querySelector('app-navbar');
        if (navbar) navbar.style.display = 'none';

        // Reset bouton avant le check asynchrone
        const joinBtn = this.querySelector('#joinActionBtn');
        if (joinBtn) {
            joinBtn.innerHTML = '<i class="material-icons-round" style="animation: spin 1s linear infinite; vertical-align: middle; font-size: 18px;">autorenew</i>';
            joinBtn.disabled = true;
        }

        // ── Vérification asynchrone de l'état (créateur ? déjà rejoint ?) ──
        await this._checkUserStatus(data);

        // PAR-02 / PAR-03 / PAR-05 : relire la réservation ou reprendre un
        // paiement laissé en attente. Le retour CinetPay ne fait jamais preuve.
        if (this._paidJourney && this._desireId) {
            try {
                const { api } = await import('../../api.js');
                if (api.isAuthenticated()) {
                    await this._loadPaidState(api);
                }
            } catch (err) {
                console.warn('[DesireDetails] État de paiement indisponible:', err.message);
            }
            this._updateJoinButton(joinBtn);
        }

        // NAV-05 : mettre en évidence les champs concernés par la modification.
        // PAR-16 : idem pour le lieu exact et la date lors d'un rappel.
        if (notificationType === 'desire_updated'
            || notificationType === 'reminder_day'
            || notificationType === 'reminder_soon') {
            this._highlightChangedFields();
        }

        if (focus) {
            requestAnimationFrame(() => this._focusTarget(focus));
        }
    }

    /**
     * Fait défiler la vue vers l'action attendue par la notification (NIN-06).
     * Les sections conditionnelles (participants, footer) sont ignorées si
     * l'état courant ne les affiche pas. L'action n'est jamais exécutée :
     * l'utilisateur reste maître de la confirmation (CDC §11).
     */
    _focusTarget(focus) {
        const selectors = {
            'participant-requests': '#participantsSection',
            'confirm-presence': '#joinActionBtn',
            'practical-info': '#dMeta',
            'maintenance': '#dMaintenanceStrip',
        };
        const selector = selectors[focus];
        if (!selector) return;

        const element = this.querySelector(selector);
        if (!element || element.offsetParent === null) return;

        element.setAttribute('tabindex', '-1');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus({ preventScroll: true });

        element.classList.add('cta-focus');
        setTimeout(() => element.classList.remove('cta-focus'), 4000);
    }

    /**
     * Met en évidence les informations pratiques (heure, lieu exact) : champs
     * modifiés par une modification importante (NAV-05) ou à retrouver lors
     * d'un rappel (PAR-16). Le highlight est transitoire.
     */
    _highlightChangedFields() {
        const targets = [
            this.querySelector('#dDate'),
            this.querySelector('#dCommune'),
            this.querySelector('#dAddressWrap'),
        ];
        targets.forEach(el => el?.classList.add('field-changed'));
        setTimeout(() => {
            targets.forEach(el => el?.classList.remove('field-changed'));
        }, 4000);
    }

    /**
     * Vérifie si l'utilisateur est le créateur ou a déjà rejoint l'envie.
     */
    async _checkUserStatus(data) {
        const joinBtn = this.querySelector('#joinActionBtn');
        const participantsSection = this.querySelector('#participantsSection');

        try {
            const { api } = await import('../../api.js');
            if (!api.isAuthenticated()) {
                // Non connecté : inviter à se connecter pour rejoindre
                if (joinBtn) {
                    joinBtn.disabled = false;
                    joinBtn.innerHTML = '<i class="material-icons-round" style="font-size:18px;vertical-align:middle;">login</i> Se connecter pour rejoindre';
                }
                return;
            }

            // Récupérer l'utilisateur connecté (via cache localStorage d'abord)
            const cachedUser = JSON.parse(localStorage.getItem('dystrax-user') || 'null');
            const me = cachedUser || await api.getMe();

            // Optimisation : si la carte indique déjà que l'utilisateur a rejoint (mode='joined')
            if (data.isJoined === true) {
                this._hasJoined = true;
                participantsSection?.classList.remove('visible');
                // Le statut exact (accepté / présence confirmée / échéance dépassée) reste à préciser (PAR-08/10).
                try {
                    const joined = await api.getJoinedDesires();
                    const match = Array.isArray(joined) && joined.find(d => String(d.id) === String(this._desireId));
                    this._applyJoinStatus(match);
                } catch { /* l'état « rejoint » reste affiché */ }
                if (joinBtn) { joinBtn.disabled = false; this._updateJoinButton(joinBtn); }
                return;
            }

            // Vérifier si créateur (comparaison type-safe string/number)
            if (me && data.authorId && String(me.id) === String(data.authorId)) {
                this._isCreator = true;
            }

            if (this._isCreator) {
                // —— Mode créateur : afficher les intéressés ——
                participantsSection?.classList.add('visible');
                this._applyMaintenanceState(data);
                await this._loadParticipants(api);
            } else if (data.spots === 'Complet') {
                // —— Envie complète ——
                participantsSection?.classList.remove('visible');
                this._isFull = true;
            } else {
                // —— Mode participant : vérifier le statut de participation ——
                participantsSection?.classList.remove('visible');
                const joined = await api.getJoinedDesires();
                const match = Array.isArray(joined) && joined.find(d => String(d.id) === String(this._desireId));
                this._hasJoined = !!match;
                this._applyJoinStatus(match);
            }
        } catch (err) {
            console.warn('[DesireDetails] Erreur lors du check statut :', err.message);
        } finally {
            if (joinBtn) {
                joinBtn.disabled = false;
                this._updateJoinButton(joinBtn);
            }
        }
    }

    /**
     * Affiche le bandeau de maintien à l'organisateur dont l'échéance approche
     * (ORG-08/09), tant qu'il ne s'est pas prononcé et que l'activité n'est ni
     * annulée ni passée.
     * @param {object} data
     */
    _applyMaintenanceState(data) {
        const strip = this.querySelector('#dMaintenanceStrip');
        if (!strip) return;
        const needed = data?.needs_maintenance === true || this._needsMaintenance === true;
        const visible = this._isCreator && needed && !this._isCancelled && !this._isPast;
        strip.style.display = visible ? 'flex' : 'none';
    }

    /**
     * Applique le statut de participation issu de GET /me/joined (PAR-08 / PAR-10).
     * 'rejected' → plus de CTA ; 'confirmed' → présence confirmée ;
     * 'accepted' → confirmation demandée ; 'expired' → place libérée.
     * @param {object|null|undefined} match
     */
    _applyJoinStatus(match) {
        if (!match) return;
        // Les entrées issues de `paid_bookings` portent `booking_id` : leur
        // statut est celui de la réservation (PAR-02 / PAR-05), pas celui d'une
        // participation gratuite.
        if (match.booking_id) {
            this._bookingId = match.booking_id;
            this._ticketId = match.ticket_id || null;
            this._paymentId = match.payment_id || null;
            if (match.status === 'confirmed') {
                this._hasJoined = true;
                this._isConfirmed = true;
                this._bookingStatus = 'confirmed';
            } else if (match.status === 'refund_due') {
                this._hasJoined = true;
                this._bookingStatus = 'refund_due';
            } else if (match.status === 'cancelled') {
                // Le reçu reste accessible ; la place est libérée.
                this._hasJoined = true;
                this._bookingStatus = 'cancelled';
            }
            return;
        }
        if (match.status === 'rejected') {
            this._hasJoined = false;
            this._isRejected = true;
        } else if (match.status === 'confirmed') {
            this._isConfirmed = true;
        } else if (match.status === 'accepted') {
            this._isAccepted = true;
        } else if (match.status === 'expired') {
            this._hasJoined = false;
        }
    }

    /**
     * Charge la liste des participants (visible uniquement pour le créateur).
     */
    async _loadParticipants(api) {
        const list = this.querySelector('#participantsList');
        const badge = this.querySelector('#participantsBadge');
        if (!list) return;

        try {
            const raw = await api.getDesireParticipants(this._desireId);
            if (!list) return; // page fermée entre-temps

            // Normaliser la réponse : tableau direct ou objet wrappé
            const participants = Array.isArray(raw)
                ? raw
                : (raw?.participants || raw?.items || raw?.data || []);

            if (!participants || participants.length === 0) {
                list.innerHTML = `<p class="participants-empty">Aucun intérêssé pour l'instant.</p>`;
                if (badge) badge.textContent = '0';
                return;
            }

            if (badge) badge.textContent = participants.length;

            // Compteurs accepté/refusé (une présence confirmée reste un engagement accepté)
            const accepted = participants.filter(p => p.status === 'accepted' || p.status === 'confirmed').length;
            const rejected = participants.filter(p => p.status === 'rejected').length;
            const countersEl = this.querySelector('#participantsCounters');
            if (countersEl && (accepted > 0 || rejected > 0)) {
                countersEl.style.display = 'flex';
                const countAcc = this.querySelector('#countAccepted');
                const countRej = this.querySelector('#countRejected');
                if (countAcc) countAcc.textContent = accepted;
                if (countRej) countRej.textContent = rejected;
            }

            // Styles des statuts
            const statusStyles = {
                confirmed: { bg: '#dbeafe', color: '#2563eb', label: 'Confirmé' },
                accepted: { bg: '#d1fae5', color: '#059669', label: 'Accepté' },
                rejected: { bg: '#fee2e2', color: '#ef4444', label: 'Refusé' },
                pending: { bg: '#fef3c7', color: '#d97706', label: 'En attente' },
            };

            list.innerHTML = participants.map(p => {
                const st = statusStyles[p.status] || statusStyles.pending;
                const isPending = !p.status || p.status === 'pending';
                const pseudoSafe = escapeHtml(p.pseudo || 'Utilisateur');
                const avatarSrc = resolveImageUrl(p.avatar_url || p.avatar) || DEFAULT_AVATAR_PATH;
                const avatarFallback = escapeHtml(DEFAULT_AVATAR_DATA_URI);
                const phoneDisplay = escapeHtml(p.phone || '');
                const phoneDigits = p.phone ? String(p.phone).replace(/\D/g, '') : '';
                const userIdSafe = escapeHtml(String(p.user_id));
                return `
                <div class="participant-item" data-user-id="${userIdSafe}" style="display:flex; flex-direction:column; gap:8px; padding:12px; border-radius:12px; background:var(--bg-main); border:1px solid ${(p.status === 'accepted' || p.status === 'confirmed') ? '#10b981' : 'var(--border-light)'};">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img 
                            src="${escapeHtml(avatarSrc)}"
                            alt="${pseudoSafe}"
                            class="participant-avatar"
                            data-fallback-avatar="${avatarFallback}"
                            onerror="this.onerror=null;this.src=this.getAttribute('data-fallback-avatar')"
                        >
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:14px; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${pseudoSafe}
                            </div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                                ${p.joined_at ? new Date(p.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                        <span style="font-size:11px; font-weight:600; padding:3px 8px; border-radius:100px; background:${st.bg}; color:${st.color}; white-space:nowrap; flex-shrink:0;">
                            ${st.label}
                        </span>
                        ${isPending ? `
                        <div class="participant-actions" style="display:flex; gap:6px; flex-shrink:0;">
                            <button class="accept-btn" data-user-id="${userIdSafe}" title="Accepter"
                                style="width:36px; height:36px; border-radius:50%; border:none; background:#d1fae5; color:#059669; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                                <i class="material-icons-round" style="font-size:18px;">check_circle</i>
                            </button>
                            <button class="reject-btn" data-user-id="${userIdSafe}" title="Refuser"
                                style="width:36px; height:36px; border-radius:50%; border:none; background:#fee2e2; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                                <i class="material-icons-round" style="font-size:18px;">cancel</i>
                            </button>
                        </div>` : ''}
                    </div>
                    ${p.status === 'accepted' && phoneDigits ? `
                    <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:color-mix(in srgb,#10b981 8%,transparent); border-radius:10px; border:1px solid color-mix(in srgb,#10b981 25%,transparent);">
                        <i class="material-icons-round" style="font-size:18px; color:#059669; flex-shrink:0;">phone</i>
                        <span style="font-size:13px; font-weight:600; color:var(--text-main); flex:1; letter-spacing:0.5px;">${phoneDisplay}</span>
                        <a href="tel:${escapeHtml(phoneDigits)}" title="Appeler"
                            style="width:34px; height:34px; border-radius:50%; background:#059669; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0; transition:opacity 0.2s;">
                            <i class="material-icons-round" style="font-size:17px;">call</i>
                        </a>
                        <a href="https://wa.me/${escapeHtml(phoneDigits)}" target="_blank" rel="noopener" title="WhatsApp"
                            style="width:34px; height:34px; border-radius:50%; background:#25d366; color:white; display:flex; align-items:center; justify-content:center; text-decoration:none; flex-shrink:0; transition:opacity 0.2s;">
                            <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white;" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                        </a>
                    </div>` : ''}
                </div>`;
            }).join('');

            // Câbler les boutons accept/reject
            list.querySelectorAll('.accept-btn').forEach(btn => {
                btn.addEventListener('click', () => this._handleParticipantAction('accept', btn.dataset.userId, api));
            });
            list.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => this._handleParticipantAction('reject', btn.dataset.userId, api));
            });

        } catch (err) {
            if (list) list.innerHTML = `<p class="participants-empty">Impossible de charger les participants.</p>`;
            console.warn('[DesireDetails] Participants non chargés :', err.message);
        }
    }

    /** Accepter ou refuser un participant, avec retour visuel */
    async _handleParticipantAction(action, userId, api) {
        const item = this.querySelector(`.participant-item[data-user-id="${userId}"]`);
        if (!item) return;

        const actions = item.querySelector('.participant-actions');
        if (actions) {
            actions.innerHTML = `<i class="material-icons-round" style="font-size:18px; animation: spin 1s linear infinite; color:var(--text-muted);">autorenew</i>`;
        }

        try {
            if (action === 'accept') {
                await api.acceptParticipant(this._desireId, userId);
            } else {
                await api.rejectParticipant(this._desireId, userId);
            }
            // Recharger la liste
            await this._loadParticipants(api);
        } catch (err) {
            if (actions) actions.innerHTML = `<span style="font-size:12px; color:#ef4444;">Erreur</span>`;
            console.warn('[DesireDetails] Action participant échouée:', err.message);
        }
    }

    /** Indique si l'overlay de détail est actuellement affiché (pour le bouton retour device). */
    isOpen() {
        const overlay = this.querySelector('#detailsOverlay');
        return overlay && overlay.classList.contains('active') && overlay.style.display !== 'none';
    }

    close() {
        const page = this.querySelector('#desireDetailsPage');
        const overlay = this.querySelector('#detailsOverlay');
        const participantsSection = this.querySelector('#participantsSection');

        page.classList.remove('active');
        overlay.classList.remove('active');
        if (participantsSection) participantsSection.classList.remove('visible');

        setTimeout(() => {
            page.style.display = 'none';
            overlay.style.display = 'none';
        }, 300);

        // Restaurer le scroll de la page
        const html = document.documentElement;
        html.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, this._savedScrollY);

        // Laisser le routeur gérer la navbar selon la page courante (home = visible, profil/notifs = cachée)
        window.dispatchEvent(new CustomEvent('desire-detail-closed', { bubbles: true, composed: true }));
    }

    /** Partager l'envie : lien simple, sans intention particulière. */
    _handleShare() {
        this._shareDesire();
    }

    /**
     * Inviter des proches à rejoindre l'envie (créateur).
     *
     * Le lien porte ``notification_action=confirm-presence`` : à l'ouverture, le
     * détail met en avant le bouton « Rejoindre » (CDC §11) sans jamais inscrire
     * le destinataire à sa place.
     */
    _handleInvite() {
        this._shareDesire({ focus: 'confirm-presence', verb: 'Rejoins cette envie sur Dystrax' });
    }

    /**
     * Partage un lien profond vers l'envie : Web Share API (natif) ou
     * bottom-sheet (repli). ``focus`` ajoute l'action à mettre en avant à
     * l'ouverture du lien partagé.
     */
    _shareDesire({ focus = '', verb = 'Découvre cette envie sur Dystrax' } = {}) {
        if (!this._desireId) return;
        const titleEl = this.querySelector('#dTitle');
        const title = (titleEl && titleEl.textContent) ? titleEl.textContent.trim() : 'Une envie sur Dystrax';
        let url = `${window.location.origin}${window.location.pathname || '/'}#desire/${this._desireId}`;
        if (focus) url += `?notification_action=${encodeURIComponent(focus)}`;
        const text = `${title} — ${verb}`;

        // Web Share API — ouvre le menu natif du système (WhatsApp, Instagram, TikTok, etc.)
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            navigator.share({ title: 'Dystrax', text, url })
                .then(() => {
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Partage réussi', type: 'success' } }));
                })
                .catch((err) => {
                    if (err.name === 'AbortError') return; // utilisateur a annulé
                    // Partage natif échoué (ex. HTTP en dev) → bottom-sheet
                    this._showShareSheet(url, text);
                });
            return;
        }
        // Fallback : bottom-sheet custom (desktop, navigateurs sans support)
        this._showShareSheet(url, text);
    }

    /**
     * Affiche une bottom-sheet avec des options de partage direct :
     * WhatsApp, Facebook, Telegram, Twitter/X, Copier le lien.
     */
    _showShareSheet(url, text) {
        const existing = document.getElementById('_dystraxShareSheet');
        if (existing) existing.remove();

        const encodedUrl  = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);

        const platforms = [
            {
                key:   'whatsapp',
                label: 'WhatsApp',
                color: '#25d366',
                href:  `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>`,
            },
            {
                key:   'facebook',
                label: 'Facebook',
                color: '#1877f2',
                href:  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>`,
            },
            {
                key:   'telegram',
                label: 'Telegram',
                color: '#0088cc',
                href:  `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>`,
            },
            {
                key:   'twitter',
                label: 'Twitter / X',
                color: '#000000',
                href:  `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
                svg: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>`,
            },
        ];

        const sheet = document.createElement('div');
        sheet.id = '_dystraxShareSheet';
        sheet.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,.5); backdrop-filter:blur(4px);
            display:flex; align-items:flex-end; justify-content:center;
            animation:ssOverlayIn .2s ease;
        `;
        sheet.innerHTML = `
            <style>
                @keyframes ssOverlayIn { from { opacity:0 } to { opacity:1 } }
                @keyframes ssSlideUp   { from { transform:translateY(100%) } to { transform:translateY(0) } }
                .ss-btn { display:flex; flex-direction:column; align-items:center; gap:8px;
                          background:none; border:none; cursor:pointer; padding:10px 8px;
                          color:var(--text-primary,#111); border-radius:12px;
                          transition:background .15s; min-width:64px; }
                .ss-btn:active { background:var(--bg-secondary,#f3f4f6); }
                .ss-icon { width:52px; height:52px; border-radius:14px; display:flex;
                           align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
                .ss-label { font-size:11px; font-weight:600; color:var(--text-muted,#6b7280); }
                .ss-copy-row { display:flex; align-items:center; gap:12px; width:100%;
                               background:var(--bg-secondary,#f3f4f6); border-radius:12px;
                               padding:12px 14px; box-sizing:border-box; }
            </style>
            <div style="background:var(--bg-primary,#fff); border-radius:24px 24px 0 0; width:100%;
                        max-width:600px; padding:20px 20px 32px;
                        animation:ssSlideUp .25s cubic-bezier(.16,1,.3,1);">
                <!-- Handle -->
                <div style="width:40px; height:4px; background:var(--border-color,#e5e7eb);
                            border-radius:2px; margin:0 auto 20px;"></div>
                <h3 style="font-size:16px; font-weight:700; margin:0 0 20px; color:var(--text-primary,#111);">
                    Partager cette envie
                </h3>
                <!-- Platform buttons -->
                <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:20px;">
                    ${platforms.map(p => `
                        <a href="${p.href}" target="_blank" rel="noopener noreferrer"
                           class="ss-btn" id="ss-${p.key}" style="text-decoration:none;">
                            <div class="ss-icon" style="background:${p.color};">
                                ${p.svg}
                            </div>
                            <span class="ss-label">${p.label}</span>
                        </a>
                    `).join('')}
                </div>
                <!-- Copy link row -->
                <div class="ss-copy-row">
                    <i class="material-icons-round" style="color:var(--primary,#6366f1); flex-shrink:0;">link</i>
                    <span id="ss-url-display" style="font-size:13px; color:var(--text-muted,#6b7280);
                          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                        ${escapeHtml(url)}
                    </span>
                    <button id="ss-copy-btn"
                        style="padding:8px 16px; background:var(--primary,#6366f1); color:#fff;
                               border:none; border-radius:10px; cursor:pointer; font-weight:600;
                               font-size:13px; flex-shrink:0; white-space:nowrap;">
                        Copier
                    </button>
                </div>
                <!-- Cancel -->
                <button id="ss-cancel"
                    style="width:100%; margin-top:14px; padding:13px; background:transparent;
                           color:var(--text-muted,#6b7280); border:none; cursor:pointer;
                           font-size:15px; font-weight:600; border-radius:12px;">
                    Annuler
                </button>
            </div>
        `;

        document.body.appendChild(sheet);

        // Fermer en cliquant sur l'overlay
        sheet.addEventListener('click', (e) => {
            if (e.target === sheet) sheet.remove();
        });
        sheet.querySelector('#ss-cancel').addEventListener('click', () => sheet.remove());

        // Copier le lien (fallback textarea + execCommand pour mobile où clipboard.writeText ne colle pas)
        sheet.querySelector('#ss-copy-btn').addEventListener('click', () => {
            const btn = sheet.querySelector('#ss-copy-btn');
            const done = () => {
                btn.textContent = 'Copié !';
                btn.style.background = '#10b981';
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Lien copié', type: 'success' } }));
                setTimeout(() => sheet.remove(), 1200);
            };

            const fallbackCopy = () => {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                ta.setSelectionRange(0, url.length);
                let ok = false;
                try {
                    ok = document.execCommand('copy');
                } catch (e) {}
                document.body.removeChild(ta);
                return ok;
            };

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(url).then(() => done()).catch(() => {
                    if (fallbackCopy()) done();
                    else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Copie non prise en charge', type: 'info' } }));
                });
            } else {
                if (fallbackCopy()) done();
                else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Copie non prise en charge', type: 'info' } }));
            }
        });

        // Fermer la feuille après clic sur un réseau (ouverture dans nouvel onglet)
        platforms.forEach(p => {
            sheet.querySelector(`#ss-${p.key}`)?.addEventListener('click', () => {
                setTimeout(() => sheet.remove(), 300);
            });
        });
    }

    renderCarousel() {
        const carousel = this.querySelector('#detailsHeroCarousel');
        const thumbsContainer = this.querySelector('#detailsThumbnails');

        carousel.innerHTML = '';
        thumbsContainer.innerHTML = '';

        if (this.images.length === 0) {
            thumbsContainer.style.display = 'none';
            // Placeholder si aucune image
            carousel.style.background = 'var(--bg-card)';
            return;
        }

        thumbsContainer.style.display = this.images.length > 1 ? 'flex' : 'none';

        this.images.forEach((fullUrl, i) => {
            const mediumUrl = getImageVariantUrl(fullUrl, 'medium') || fullUrl;
            const slide = document.createElement('img');
            slide.src = mediumUrl;
            slide.dataset.fallback = fullUrl;
            slide.className = 'hero-slide';
            slide.alt = `Image ${i + 1}`;
            slide.onerror = function () {
                this.onerror = null;
                if (this.dataset.fallback) this.src = this.dataset.fallback;
            };
            slide.addEventListener('click', () => this.openLightbox(i));
            carousel.appendChild(slide);

            if (this.images.length > 1) {
                const thumb = document.createElement('img');
                thumb.src = mediumUrl;
                thumb.dataset.fallback = fullUrl;
                thumb.className = `thumbnail ${i === 0 ? 'active' : ''}`;
                thumb.alt = `Miniature ${i + 1}`;
                thumb.onerror = function () {
                    this.onerror = null;
                    if (this.dataset.fallback) this.src = this.dataset.fallback;
                };
                thumb.addEventListener('click', () => {
                    const targetScroll = carousel.offsetWidth * i;
                    carousel.scrollTo({ left: targetScroll, behavior: 'smooth' });
                    this.currentIndex = i;
                    this.updateThumbnails();
                });
                thumbsContainer.appendChild(thumb);
            }
        });

        carousel.scrollLeft = 0;
    }

    /** Ouvre le lightbox fullscreen à l'index donné */
    openLightbox(startIndex = 0) {
        if (!this.images || this.images.length === 0) return;

        // Construire le lightbox
        let lb = this.querySelector('#detailsLightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'detailsLightbox';
            lb.className = 'lightbox';
            lb.innerHTML = `
                <button class="lightbox-close" id="lbClose" aria-label="Fermer">
                    <i class="material-icons-round">close</i>
                </button>
                <div class="lightbox-counter" id="lbCounter">1 / 1</div>
                <div class="lightbox-track" id="lbTrack"></div>
                <div class="lightbox-dots" id="lbDots"></div>
            `;
            this.appendChild(lb);

            // Fermer au clic sur le fond (pas sur l'image)
            lb.addEventListener('click', (e) => {
                if (e.target === lb || e.target.classList.contains('lightbox-slide')) {
                    lb.classList.remove('active');
                    document.body.style.overflow = 'hidden'; // garder le détails scrollé
                }
            });
            lb.querySelector('#lbClose').addEventListener('click', () => {
                lb.classList.remove('active');
            });
        }

        // Remplir le track
        const track = lb.querySelector('#lbTrack');
        const counter = lb.querySelector('#lbCounter');
        const dotsContainer = lb.querySelector('#lbDots');
        track.innerHTML = '';
        dotsContainer.innerHTML = '';

        this.images.forEach((src, i) => {
            const slide = document.createElement('div');
            slide.className = 'lightbox-slide';
            const img = document.createElement('img');
            img.src = src; // lightbox: full resolution
            img.alt = `Image ${i + 1}`;
            slide.appendChild(img);
            track.appendChild(slide);

            const dot = document.createElement('div');
            dot.className = `lightbox-dot${i === startIndex ? ' active' : ''}`;
            dotsContainer.appendChild(dot);
        });

        // Aller à l'index de départ
        const updateLightboxUI = (idx) => {
            counter.textContent = `${idx + 1} / ${this.images.length}`;
            dotsContainer.querySelectorAll('.lightbox-dot').forEach((d, i) => {
                d.classList.toggle('active', i === idx);
            });
        };

        // Mettre à jour le compteur au scroll
        track.addEventListener('scroll', () => {
            if (track.offsetWidth === 0) return;
            const idx = Math.round(track.scrollLeft / track.offsetWidth);
            updateLightboxUI(idx);
        });

        lb.classList.add('active');

        // Scroller vers l'index sans animation (instantané)
        requestAnimationFrame(() => {
            track.scrollLeft = track.offsetWidth * startIndex;
            updateLightboxUI(startIndex);
        });
    }

    updateThumbnails() {
        const thumbs = this.querySelectorAll('.thumbnail');
        thumbs.forEach((thumb, i) => {
            if (i === this.currentIndex) thumb.classList.add('active');
            else thumb.classList.remove('active');

            if (i === this.currentIndex) {
                const container = this.querySelector('#detailsThumbnails');
                const scrollLeft = thumb.offsetLeft - (container.offsetWidth / 2) + (thumb.offsetWidth / 2);
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        });
    }
}

customElements.define('app-desire-details', DesireDetailsPage);
