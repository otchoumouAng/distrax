export const financeLabels = {
    payment_mismatch: 'Encaissement incohérent', payment_pending: 'Paiement à vérifier',
    boost_payment_review: 'Boost payé à examiner',
    refund_review: 'Remboursement à examiner', payout_review: 'Reversement à examiner',
    job_failed: 'Traitement interrompu', job_stalled: 'Traitement à reprendre', job_waiting: 'Traitement en retard',
    dispute_open: 'Signalement ouvert', ticket_unscanned: 'Billet non scanné',
    external_difference: 'Écart avec le relevé externe',
    notification_failed: 'Notification financière non distribuée', queued: 'En attente',
    requested: 'À prendre en charge', processing: 'En traitement', unknown: 'Résultat à vérifier',
    failed: 'Échec confirmé', succeeded: 'Payé', open: 'Ouvert', review_required: 'En examen',
};
export function refundActions(status) {
    if (status === 'requested') return ['claim'];
    if (status === 'processing' || status === 'unknown') return ['result'];
    if (status === 'failed') return ['retry'];
    return [];
}
export function refundResult(row, values) {
    const body = { expected_version: row.version, execution_id: row.execution_id,
        outcome: values.outcome, evidence_ids: [values.evidence] };
    if (body.outcome === 'succeeded') {
        if (!values.reference || !values.executed) throw new Error('Référence et date réelles obligatoires.');
        body.external_reference = values.reference;
        body.executed_at = new Date(values.executed).toISOString();
    } else body.reason = values.reason;
    return body;
}
