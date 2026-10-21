import { describe, it, expect } from 'vitest';
import { canCancelRequest } from './cancel-request';

const pending = { type: 'EXPENSE', status: 'PENDING', userId: 'u1' };

describe('canCancelRequest', () => {
    it('lets the requester cancel their own pending withdrawal', () => {
        expect(canCancelRequest(pending, 'u1')).toBe(true);
    });

    it('refuses anyone other than the requester', () => {
        expect(canCancelRequest(pending, 'u2')).toBe(false);
        expect(canCancelRequest(pending, null)).toBe(false);
    });

    it('refuses once an admin has acted, or after a cancel', () => {
        for (const status of ['APPROVED', 'REJECTED', 'CANCELLED']) {
            expect(canCancelRequest({ ...pending, status }, 'u1')).toBe(false);
        }
    });

    it('refuses deposits', () => {
        expect(canCancelRequest({ ...pending, type: 'INCOME' }, 'u1')).toBe(false);
    });
});
