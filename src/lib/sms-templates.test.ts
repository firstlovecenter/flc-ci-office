import { describe, it, expect } from 'vitest';
import { generateRequestCancelledSms } from './sms-templates';

describe('generateRequestCancelledSms', () => {
    it('names the requester, the exact amount and the reference, and asks for nothing', () => {
        expect(generateRequestCancelledSms({ userName: 'Ama', currency: 'GH₵', amount: '1,250.50', description: 'Fuel' }))
            .toBe('Ama cancelled their withdrawal request of GH₵1,250.50. Ref: Fuel. No action needed.');
    });
});
