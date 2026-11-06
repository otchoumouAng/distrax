import { escapeHtml as e } from '../../utils/escapeHtml.js';
import { formatAmount, formatDeadline } from '../../utils/paymentFlow.js';
import './paymentScreens.css';

/** Le devis est présenté avant toute réservation ou redirection vers le prestataire. */
export function confirmPaymentQuote({ quote, title, location = '' }) {
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'payment-confirmation';
        dialog.setAttribute('aria-labelledby', 'paymentConfirmationTitle');
        dialog.innerHTML = `<header class="flow-header"><button class="round-icon-btn" data-back aria-label="Retour"><i class="material-icons-round">arrow_back</i></button><h1 id="paymentConfirmationTitle">Confirmer ma place</h1><span></span></header>
            <div class="flow-body"><div class="flow-card"><h2>${e(title)}</h2><p class="flow-muted">${e(location)}</p><p class="flow-muted">1 personne</p></div>
            <div class="flow-card"><div class="flow-row"><span class="flow-muted">Participation</span><strong>${e(formatAmount(quote.price_amount,quote.currency))}</strong></div>
            ${quote.participant_fee ? `<div class="flow-row"><span class="flow-muted">Frais de service</span><strong>${e(formatAmount(quote.participant_fee,quote.currency))}</strong></div>` : ''}
            <div class="flow-line"></div><div class="flow-row"><strong>Total à payer</strong><strong>${e(formatAmount(quote.total_amount,quote.currency))}</strong></div></div>
            <div class="flow-notice">${quote.cancellation_available ? `Annulation possible jusqu’au ${e(formatDeadline(quote.cancellation_deadline))}, soit 24 h avant l’événement.` : 'La limite d’annulation est passée. Cette réservation ne pourra plus être annulée librement.'}</div>
            <div class="flow-card"><h3>Paiement sécurisé</h3><p class="flow-muted">Votre place sera confirmée après validation du paiement. Vous recevrez votre billet et votre reçu dans Distrax.</p></div></div>
            <footer class="flow-footer"><button class="flow-btn" data-continue>Continuer vers le paiement</button></footer>`;
        const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
        dialog.querySelector('[data-back]').onclick = () => finish(false);
        dialog.querySelector('[data-continue]').onclick = () => finish(true);
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        document.body.append(dialog);
        dialog.showModal();
    });
}
