import { api } from '../../api.js';
import { escapeHtml as e } from '../../utils/escapeHtml.js';
import { formatAmount, formatDeadline, PAYOUT_STATUS_LABELS } from '../../utils/paymentFlow.js';
import './paymentScreens.css';

const states = { open: 'Ouvert', review_required: 'À examiner', closed: 'Clôturé' };
export class PaymentCases extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<div class="flow-card" style="margin-bottom:16px"><h3 class="admin-card-title"><i class="material-icons-round">payments</i>Dossiers des envies</h3><p class="admin-card-hint">Un dossier est ouvert au premier paiement confirmé.</p><form class="flow-search"><input class="form-input" name="q" placeholder="Rechercher une envie" aria-label="Rechercher une envie" maxlength="200"><button class="admin-search-btn" aria-label="Rechercher"><i class="material-icons-round">search</i></button></form></div><div data-cases aria-live="polite"></div>`;
        this.querySelector('form').onsubmit = event => { event.preventDefault(); this.load(); };
    }
    async load(offset = 0) {
        const generation = this._generation = (this._generation || 0) + 1;
        const root = this.querySelector('[data-cases]');
        if (!root) return;
        root.innerHTML = '<p class="flow-muted">Chargement des dossiers…</p>';
        this.dispatchEvent(new CustomEvent('close-booking-detail', { bubbles: true }));
        const query = this.querySelector('[name=q]').value.trim();
        try {
            const data = await api.financeRequest(`/admin/payment-events?q=${encodeURIComponent(query)}&offset=${offset}&limit=30`);
            if (generation !== this._generation) return;
            const counts = data.counts || {};
            root.innerHTML = `<div class="flow-counts">${[['open','Ouverts'],['review_required','À examiner'],['closed','Clôturés']].map(([key,label]) => `<div class="flow-card"><strong>${e(String(counts[key] ?? 0))}</strong><span class="flow-muted">${label}</span></div>`).join('')}</div>
                <div style="display:grid;gap:16px">${data.items.map((item,index) => `<button class="flow-card flow-event-button" data-event="${index}"><div class="flow-row"><h3>${e(item.title)}</h3><i class="material-icons-round">chevron_right</i></div><p class="flow-muted">${e(item.organizer_name)} · ${e(formatDeadline(item.event_date))}</p><div class="flow-row" style="margin-top:12px"><strong>${e(formatAmount(item.collected,item.currency))}</strong><span class="flow-muted">${e(String(item.payment_count))} paiements</span></div><p class="flow-muted">${e(states[item.status] || item.status)}</p></button>`).join('') || '<p class="flow-muted">Aucun dossier pour cette recherche.</p>'}</div>
                <div class="flow-row" style="margin-top:16px">${offset ? '<button class="flow-link" data-prev>Précédents</button>' : ''}${data.next_offset != null ? '<button class="flow-link" data-next>Suivants</button>' : ''}</div>`;
            root.querySelectorAll('[data-event]').forEach(button => button.onclick = () => this.open(data.items[Number(button.dataset.event)]));
            root.querySelector('[data-prev]')?.addEventListener('click', () => this.load(Math.max(0, offset-30)));
            root.querySelector('[data-next]')?.addEventListener('click', () => this.load(data.next_offset));
        } catch (error) { if (generation === this._generation) this._error(root,error,() => this.load(offset)); }
    }
    async open(event, cursor = null) {
        const generation = this._generation = (this._generation || 0) + 1;
        const root = this.querySelector('[data-cases]');
        root.innerHTML = '<p class="flow-muted">Chargement du dossier…</p>';
        this.dispatchEvent(new CustomEvent('close-booking-detail', { bubbles: true }));
        try {
            const [detail,page] = await Promise.all([
                api.financeRequest(`/admin/payment-events/${encodeURIComponent(event.desire_id)}`),
                api.getAdminPayments({ desire_id: event.desire_id, cursor, limit: 30 }),
            ]);
            if (generation !== this._generation) return;
            const balances = detail.balances || {};
            root.innerHTML = `<button class="flow-link" data-back>← Tous les dossiers</button>
                <div class="flow-card"><h3>${e(event.title)}</h3><p class="flow-muted">${e(event.organizer_name)} · ${e(formatDeadline(event.event_date))}</p><div class="flow-money" style="margin-top:16px">${[['Encaissé',event.collected],['En attente',balances.pending || 0],['Disponible',balances.available || 0],['Retenu',balances.held || 0]].map(([label,value]) => `<div><span class="flow-muted">${label}</span><strong>${e(formatAmount(value,event.currency))}</strong></div>`).join('')}</div></div>
                <div class="flow-card" style="margin-top:16px"><h3>Participants</h3>${page.items.map((item,index) => `<button class="flow-event-button flow-person flow-row" style="background:none;border:0;border-bottom:1px solid var(--border-light)" data-booking="${index}"><div><strong>${e(item.participant_name)}</strong><p class="flow-muted">${item.refund_status !== 'none' ? 'Remboursement à consulter' : item.ticket_status === 'checked_in' ? 'Présence validée' : item.ticket_status === 'void' ? 'Billet annulé' : item.payment_status === 'succeeded' ? 'Payé · À scanner' : 'Paiement à consulter'}</p></div><strong>${e(formatAmount(item.total_amount,item.currency))}</strong><i class="material-icons-round">chevron_right</i></button>`).join('') || '<p class="flow-muted">Aucune réservation.</p>'}
                ${page.next_cursor ? '<button class="flow-link" data-more>Participants suivants</button>' : ''}${cursor ? '<button class="flow-link" data-first>Revenir aux premiers participants</button>' : ''}</div>
                <div class="flow-card" style="margin-top:16px"><h3>Reversements</h3>${detail.payouts.map(p => `<div class="flow-person"><strong>${e(formatAmount(p.allocated_amount,p.currency))}</strong><p class="flow-muted">${e(PAYOUT_STATUS_LABELS[p.status] || (p.status === 'queued' ? 'Retrait demandé' : p.status))} · ${e(formatDeadline(p.created_at))}</p><p class="flow-muted">Part de cette envie dans le retrait</p></div>`).join('') || '<p class="flow-muted">Aucune demande pour cette envie.</p>'}${detail.payouts.length === 100 ? '<p class="flow-muted">Les 100 derniers reversements sont affichés.</p>' : ''}</div>`;
            root.querySelector('[data-back]').onclick = () => this.load();
            root.querySelector('[data-more]')?.addEventListener('click', () => this.open(event,page.next_cursor));
            root.querySelector('[data-first]')?.addEventListener('click', () => this.open(event));
            root.querySelectorAll('[data-booking]').forEach(button => button.onclick = () => this.dispatchEvent(new CustomEvent('open-booking-detail', { bubbles:true, detail:{bookingId:page.items[Number(button.dataset.booking)].booking_id} })));
        } catch (error) { if (generation === this._generation) this._error(root,error,() => this.open(event,cursor)); }
    }
    _error(root,error,retry) {
        root.innerHTML = `<p class="flow-muted" role="alert">${e(error.message || 'Chargement impossible.')}</p><button class="flow-btn secondary" data-retry>Réessayer</button>`;
        root.querySelector('[data-retry]').onclick = retry;
    }
}
customElements.define('payment-cases', PaymentCases);
