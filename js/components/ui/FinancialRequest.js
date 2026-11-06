import { api, newIdempotencyKey } from '../../api.js';
import { escapeHtml as e } from '../../utils/escapeHtml.js';

export class FinancialRequest extends HTMLElement {
    connectedCallback() {
        this.innerHTML=`<details style="padding:16px;border:1px solid var(--border-light);border-radius:14px;background:var(--bg-card);color:var(--text-main)">
            <summary>Signaler un problème</summary>
            <p>Décrivez le problème rencontré. Notre équipe examinera votre dossier et vous informera de sa décision.</p>
            <form style="display:grid;gap:12px">
            <label>Motif<textarea name="reason" class="form-input" minlength="10" maxlength="2000" required></textarea></label>
            <button type="submit" class="btn btn-primary">Envoyer le signalement</button><p role="status"></p></form></details>`;
        const form=this.querySelector('form');let key;
        form.oninput=()=>{key=undefined;};
        form.onsubmit=async ev=>{
            ev.preventDefault();const button=form.querySelector('button');button.disabled=true;
            const v=Object.fromEntries(new FormData(form));
            try {
                const path=`/bookings/${encodeURIComponent(this.getAttribute('booking-id'))}/disputes`;
                const body={reason:String(v.reason),evidence_ids:[]};
                key ||= newIdempotencyKey();
                const result=await api.financeRequest(path,body,key);
                form.innerHTML=`<p role="status">Signalement enregistré. Vos fonds seront examinés par notre équipe.<br>Référence : ${e(result.id)}</p>`;
            } catch(err) {form.querySelector('[role=status]').textContent=err.message || 'Envoi non confirmé. Vous pouvez réessayer.';button.disabled=false;}
        };
    }
}
customElements.define('financial-request',FinancialRequest);
