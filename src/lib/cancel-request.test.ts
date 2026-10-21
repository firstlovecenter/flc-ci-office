import { describe, it, expect } from 'vitest';
import { canCancelRequest, displayStatus, statusWhere } from './cancel-request';

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
        for (const status of ['APPROVED', 'REJECTED']) {
            expect(canCancelRequest({ ...pending, status }, 'u1')).toBe(false);
        }
    });

    it('refuses deposits', () => {
        expect(canCancelRequest({ ...pending, type: 'INCOME' }, 'u1')).toBe(false);
    });
});

describe('displayStatus', () => {
    it('shows a rejected row with cancelledAt as cancelled', () => {
        expect(displayStatus({ status: 'REJECTED', cancelledAt: '2026-10-21T10:00:00Z' })).toBe('CANCELLED');
    });

    it('leaves declined and other statuses alone', () => {
        expect(displayStatus({ status: 'REJECTED', cancelledAt: null })).toBe('REJECTED');
        expect(displayStatus({ status: 'REJECTED' })).toBe('REJECTED');
        expect(displayStatus({ status: 'PENDING' })).toBe('PENDING');
    });
});

describe('statusWhere', () => {
    it('keeps cancellations out of declined and selects only them for cancelled', () => {
        expect(statusWhere('REJECTED')).toEqual({ status: 'REJECTED', cancelledAt: null });
        expect(statusWhere('CANCELLED')).toEqual({ status: 'REJECTED', cancelledAt: { not: null } });
        expect(statusWhere('APPROVED')).toEqual({ status: 'APPROVED' });
    });
});
