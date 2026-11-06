import { api } from '../../api.js';
import { escapeHtml as e } from '../../utils/escapeHtml.js';
import { financeLabels as labels, refundActions, refundResult } from '../../utils/financeOperations.js';

/** Console operations use server states; a network failure never displays success. */
export class FinanceOperations extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<style>
            finance-operations {display:block;color:var(--text-main)}
            finance-operations form {display:grid;gap:12px;margin:14px 0}
            finance-operations label {display:grid;gap:5px}
            finance-operations input,finance-operations textarea,finance-operations select {width:100%;box-sizing:border-box;padding:10px;background:var(--bg-card);color:var(--text-main);border:1px solid var(--border-light);border-radius:8px}
            finance-operations button {padding:10px 14px;margin:4px;border:1px solid var(--border-light);border-radius:10px;color:var(--text-main);background:var(--bg-card);cursor:pointer;min-height:44px}
            finance-operations article {border-bottom:1px solid var(--border-light);padding:12px 0;overflow-wrap:anywhere}
            finance-operations summary {cursor:pointer;padding:14px 0;font-weight:600}
        </style><h3>Opérations financières</h3><button data-refresh>Actualiser</button>
        <p role="status" data-status>Ouvrez cet écran pour charger les dossiers.</p>
        <div data-content></div><div data-action></div>`;
        this.querySelector('[data-refresh]').onclick = () => this.load();
    }
    async load() {
        try {
            this.data = await api.financeRequest('/admin/finance/operations');
            const d = this.data;
            this.querySelector('[data-status]').textContent = `${d.alerts.length} alertes affichées (maximum ${d.limit}). Aucun mouvement externe automatique.`;
            this.querySelector('[data-content]').innerHTML = `
                ${d.rollout ? `<p role="status">Nouvelles ventes : ${d.rollout.checkout_enabled ? (d.rollout.rollout_mode === 'pilot' ? `pilote · ${e(String(d.rollout.pilot_organizer_count))} organisateur(s)` : 'ouvertes') : 'fermées'}. Paiements : ${d.rollout.new_attempts_enabled ? 'autorisés' : 'suspendus'} · Scans : ${d.rollout.scans_enabled ? 'autorisés' : 'suspendus'} · Retraits : ${d.rollout.payout_requests_enabled ? 'autorisés' : 'suspendus'} · Prises en charge : ${d.rollout.manual_claims_enabled ? 'autorisées' : 'suspendues'}.</p>` : ''}
                <form data-refund-search><label>Rechercher les remboursements d’une réservation<input name="booking" required pattern="[0-9a-fA-F-]{36}" placeholder="Identifiant de la réservation"></label><button>Rechercher</button></form>
                <div data-search-results></div>
                <details open><summary>Alertes et traitements bloqués</summary>${d.alerts.map(a => `<article>${e(labels[a.kind] || a.kind)} · ${e(a.resource_id)}${a.kind === 'job_failed' ? `<button data-job="${e(a.resource_id)}">Relancer</button>` : ''}</article>`).join('') || 'Aucune alerte.'}</details>
                <details><summary>Remboursements · ${d.refunds.length} premiers dossiers</summary>${d.refunds.map(r => `<article><strong>${e(String(r.amount))} ${e(r.currency)}</strong> · ${e(labels[r.status] || r.status)}<br>${e(r.id)}${refundActions(r.status).map(a => `<button data-refund="${e(r.id)}" data-operation="${a}">${{claim:'Prendre en charge',result:'Enregistrer le résultat',retry:'Reprendre après échec'}[a]}</button>`).join('')}</article>`).join('') || 'Aucun dossier.'}</details>
                <details><summary>Signalements ouverts</summary>${d.disputes.map(r => `<article>${e(r.reason)}<br>${e(r.id)} · ${e(String(r.held_amount))} XOF retenus<button data-dispute="${e(r.id)}">Examiner</button></article>`).join('') || 'Aucun signalement.'}</details>
                <details><summary>Reversements manuels</summary>${(d.payouts || []).map(r=>`<article>${e(String(r.amount))} XOF · ${e(labels[r.status] || r.status)}<br>${e(r.id)}<button data-payout="${e(r.id)}">${r.status==='queued'?'Prendre en charge':'Enregistrer le résultat'}</button></article>`).join('') || 'Aucun reversement en attente.'}</details>
                <details><summary>Billets non scannés</summary><p>Aucune décision automatique. Ouvrez un examen avant de décider.</p>${d.unscanned.map(r => `<article>${e(r.title)}<button data-open="${e(r.booking_id)}">Ouvrir un examen</button></article>`).join('') || 'Aucun billet à examiner.'}</details>
                <details><summary>Annulations et reports</summary>${d.decisions.map(r => `<article>${e(r.kind)} · ${e(r.status)} · ${e(r.desire_id)}</article>`).join('') || 'Aucune décision.'}</details>
                <details><summary>Rapprochement du relevé externe</summary><p>Convention du journal : les fonds encaissés donnent un solde de compensation négatif. Comparez le cumul des encaissements et sorties, pas un solde bancaire isolé.</p><button data-check>Enregistrer un contrôle</button>${d.ledger.map(r => `<p>${e(r.currency)} · équilibre du journal : ${e(String(r.balance))} (attendu : 0)</p>`).join('')}</details>`;
            this.querySelectorAll('[data-job]').forEach(b => b.onclick=()=>this.form('Relancer le traitement',[], v=>[`/admin/finance/jobs/${b.dataset.job}/retry`,this.reason(v)]));
            for (const alert of d.alerts.filter(a=>a.kind==='notification_failed')) {
                const button=document.createElement('button');button.textContent='Relancer la notification';
                button.onclick=()=>this.form('Relancer la notification financière',[],v=>[
                    `/admin/finance/notifications/${alert.resource_id}/retry`,this.reason(v)]);
                const reference=document.createElement('span');reference.textContent=alert.resource_id;
                this.querySelector('[data-content]').append(reference,button);
            }
            this.querySelectorAll('[data-open]').forEach(b => b.onclick=()=>this.form('Ouvrir un examen',[],v=>[`/admin/finance/bookings/${b.dataset.open}/disputes`,this.reason(v)]));
            this.querySelectorAll('[data-dispute]').forEach(b => b.onclick=()=>{
                const r=d.disputes.find(x=>x.id===b.dataset.dispute);
                this.form('Décision motivée',[['decision','Décision','select',['hold:Maintenir la retenue','refund:Rembourser','release:Débloquer après examen','reject:Clôturer le signalement']]],v=>[
                    `/admin/finance/disputes/${r.id}/decision`,{...this.reason(v),expected_version:r.version,decision:v.decision}]);
            });
            this.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>this.refund(d.refunds.find(x=>x.id===b.dataset.refund),b.dataset.operation));
            this.querySelectorAll('[data-payout]').forEach(b=>b.onclick=()=>this.payout(d.payouts.find(x=>x.id===b.dataset.payout)));
            this.querySelector('[data-refund-search]').onsubmit=async ev=>{
                ev.preventDefault();const target=this.querySelector('[data-search-results]');
                try {
                    const id=new FormData(ev.target).get('booking');
                    const page=await api.financeRequest(`/admin/refunds/search?booking_id=${encodeURIComponent(id)}&limit=100`);
                    target.innerHTML=page.items.map(r=>`<article>${e(r.id)} · ${e(labels[r.status]||r.status)}${refundActions(r.status).map(a=>`<button data-found="${e(r.id)}" data-action="${a}">${{claim:'Prendre en charge',result:'Attester le résultat',retry:'Reprendre'}[a]}</button>`).join('')}${r.status==='requested'?`<button data-fund="${e(r.id)}">Attester une provision externe</button>`:''}</article>`).join('') || 'Aucun résultat.';
                    target.querySelectorAll('[data-found]').forEach(b=>b.onclick=()=>this.refund(page.items.find(r=>r.id===b.dataset.found),b.dataset.action));
                    target.querySelectorAll('[data-fund]').forEach(b=>b.onclick=()=>this.form('Attester des fonds déjà apportés pour ce remboursement',[
                        ['amount','Provision effectivement reçue (FCFA)','number'],['reference','Référence externe du financement','text']],v=>[
                        `/admin/finance/refunds/${b.dataset.fund}/funding`,{...this.reason(v),expected_amount:Number(v.amount),external_reference:v.reference}]));
                } catch(err) {target.textContent=err.message || 'Recherche impossible.';}
            };
            this.querySelector('[data-check]').onclick=()=>this.form('Contrôle externe',[
                ['observed','Solde de compensation constaté (FCFA signés)','number'],['reference','Référence unique du relevé','text']],v=>[
                    '/admin/finance/external-checks',{...this.reason(v),observed_clearing:Number(v.observed),statement_reference:v.reference}]);
        } catch(err) { this.querySelector('[data-status]').textContent=err.message || 'Chargement impossible.'; }
    }
    reason(v) { return {reason:v.reason,evidence_ids:v.evidence?[v.evidence]:[]}; }
    payout(row) {
        if(row.status==='queued') return this.form('Prendre en charge le reversement',[],()=>[
            `/admin/payouts/${row.id}/manual-executions`,{expected_version:row.version}]);
        this.form('Attester le reversement',[
            ['outcome','Résultat','select',['unknown:À vérifier','succeeded:Succès attesté','failed:Échec confirmé']],
            ['reference','Référence externe (succès)','optional'],['executed','Date réelle (succès)','datetime-local'],
            ['amount','Montant réellement reçu (succès)','optional'],['fee','Frais réels (succès)','optional']],v=>{
                const body=refundResult(row,v);
                if(v.outcome==='succeeded') Object.assign(body,{currency:'XOF',actual_amount:Number(v.amount),actual_fee:Number(v.fee)});
                return [`/admin/payouts/${row.id}/manual-result`,body];
            });
    }
    refund(row, action) {
        if(action==='claim') this.form('Prendre en charge ce remboursement',[],()=>[
            `/admin/refunds/${row.id}/manual-executions`,{expected_version:row.version}]);
        else if(action==='retry') this.form('Reprendre après échec confirmé',[],v=>[
            `/admin/finance/refunds/${row.id}/retry`,this.reason(v)]);
        else this.form('Attester le résultat du remboursement',[
            ['outcome','Résultat','select',['unknown:À vérifier','succeeded:Succès attesté','failed:Échec confirmé']],
            ['reference','Référence externe (succès uniquement)','optional'],
            ['executed','Date réelle (succès uniquement)','datetime-local']],v=>[
                `/admin/refunds/${row.id}/manual-result`,refundResult(row,v)]);
    }
    form(title, fields, make) {
        const container=this.querySelector('[data-action]');
        container.innerHTML=`<h4>${e(title)}</h4><form>${fields.map(([name,label,type,options])=>`<label>${e(label)}${type==='select'?`<select name="${name}">${options.map(o=>{const [value,text]=o.split(':');return `<option value="${value}">${e(text)}</option>`;}).join('')}</select>`:`<input name="${name}" type="${type==='optional'?'text':type}" ${['optional','datetime-local'].includes(type)?'':'required'}>`}</label>`).join('')}
            <label>Motif détaillé<textarea name="reason" required minlength="10" maxlength="2000"></textarea></label>
            <label>Identifiant du justificatif archivé (UUID)<input name="evidence" required pattern="[0-9a-fA-F-]{36}"></label>
            <button type="submit">Confirmer</button><button type="button" data-cancel>Annuler</button><p role="status"></p></form>`;
        const form=container.querySelector('form'); let key=crypto.randomUUID();
        form.oninput=()=>{key=crypto.randomUUID();};
        form.querySelector('[data-cancel]').onclick=()=>{container.innerHTML='';};
        form.onsubmit=async ev=>{
            ev.preventDefault(); const button=form.querySelector('[type=submit]'); button.disabled=true;
            try {
                const [path,body]=make(Object.fromEntries(new FormData(form)));
                await api.financeRequest(path,body,key);
                container.innerHTML='<p role="status">Décision enregistrée.</p>'; await this.load();
            } catch(err) { form.querySelector('[role=status]').textContent=err.message || 'Résultat non confirmé. Réessayez la même action.'; }
            finally {button.disabled=false;}
        };
        container.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
}
customElements.define('finance-operations',FinanceOperations);
