import { describe, it, expect } from 'vitest';
import { refundActions, refundResult } from './financeOperations.js';
describe('manual financial operations',()=>{
    it('unknown results allow reconciliation but never another claim',()=>{
        expect(refundActions('unknown')).toEqual(['result']);
        expect(refundActions('succeeded')).toEqual([]);
        expect(refundActions('failed')).toEqual(['retry']);
    });
    it('success requires the actual reference and date',()=>{
        expect(()=>refundResult({}, {outcome:'succeeded',evidence:'proof'})).toThrow();
        expect(refundResult({version:3,execution_id:'same'}, {
            outcome:'succeeded',reference:'real',executed:'2026-10-22T12:00:00Z',evidence:'proof'
        })).toMatchObject({expected_version:3,execution_id:'same',external_reference:'real'});
    });
    it('unknown never invents an external reference',()=>{
        expect(refundResult({version:2,execution_id:'same'},{outcome:'unknown',reason:'À vérifier',evidence:'proof'}))
            .not.toHaveProperty('external_reference');
    });
});
