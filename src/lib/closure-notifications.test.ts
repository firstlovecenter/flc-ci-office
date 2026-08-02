/**
 * What the people losing access are told when an account is closed.
 *
 * Two facts have to survive every variant: the account is closed, and where the
 * money went. The funds line is shared by the SMS and the email precisely so the
 * two can never tell a recipient different things.
 */
import { describe, it, expect } from 'vitest';
import { closureFundsSummary } from './account-closure';
import { generateAccountClosureSms } from './sms-templates';
import { generateAccountClosureEmail } from './email-templates';

const transferred = closureFundsSummary({
    disposition: 'TRANSFER',
    amount: '1,200.00',
    currencySymbol: '₵',
    destinationName: 'Area 4 (New)',
});

describe('closureFundsSummary', () => {
    it('names the amount and the receiving account on a transfer', () => {
        expect(transferred).toBe('₵1,200.00 was transferred to Area 4 (New)');
    });

    it('states a withdrawal without inventing a destination', () => {
        const summary = closureFundsSummary({ disposition: 'WITHDRAW', amount: '450.00', currencySymbol: '₵' });
        expect(summary).toBe('₵450.00 was withdrawn');
    });

    it('says plainly when there was nothing left', () => {
        const summary = closureFundsSummary({ disposition: 'NONE', amount: '0.00', currencySymbol: '₵' });
        expect(summary).toMatch(/no remaining balance/i);
    });
});

describe('generateAccountClosureSms', () => {
    it('carries the account, the money and the loss of access', () => {
        const sms = generateAccountClosureSms({ accountName: 'Area 4', fundsSummary: transferred });
        expect(sms).toContain('Area 4');
        expect(sms).toContain(transferred);
        expect(sms).toMatch(/access/i);
    });

    it('includes the reason when one was given', () => {
        const sms = generateAccountClosureSms({
            accountName: 'Area 4', fundsSummary: transferred, reason: 'Switched banks',
        });
        expect(sms).toContain('Switched banks');
    });

    it('truncates a long reason rather than running to a third segment', () => {
        const sms = generateAccountClosureSms({
            accountName: 'Area 4',
            fundsSummary: transferred,
            reason: 'A very long explanation of exactly why this account had to be closed today',
        });
        expect(sms).toContain('...');
        // Two segments of a multi-part SMS; the essentials land in the first.
        expect(sms.length).toBeLessThanOrEqual(306);
    });

    it('adds nothing when the reason is blank or absent', () => {
        for (const reason of [undefined, null, '   ']) {
            const sms = generateAccountClosureSms({ accountName: 'Area 4', fundsSummary: transferred, reason });
            expect(sms).not.toMatch(/Reason:/);
        }
    });
});

describe('generateAccountClosureEmail', () => {
    const email = generateAccountClosureEmail({
        userName: 'Ama',
        accountName: 'Area 4',
        campusName: 'Revival',
        fundsSummary: transferred,
        reason: 'Switched banks',
        closedOn: new Date('2026-08-02T10:00:00Z'),
        role: 'COUNCIL_LEADER',
    });

    it('names the account in the subject', () => {
        expect(email.subject).toBe('Account closed — Area 4');
    });

    it('states the closing date, the campus, the role and where the money went', () => {
        expect(email.html).toContain('Area 4');
        expect(email.html).toContain('Revival');
        expect(email.html).toContain('2 August 2026');
        expect(email.html).toContain('Account holder');
        expect(email.html).toContain(transferred);
        expect(email.html).toContain('Switched banks');
    });

    it('says access is gone but the history is kept', () => {
        expect(email.html).toMatch(/access to this account has been removed/i);
        expect(email.html).toMatch(/auditable|records/i);
    });

    it('omits optional rows rather than printing empty ones', () => {
        const bare = generateAccountClosureEmail({
            userName: 'Ama',
            accountName: 'Area 4',
            fundsSummary: transferred,
            closedOn: new Date('2026-08-02T10:00:00Z'),
        });
        expect(bare.html).not.toContain('Reason');
        expect(bare.html).not.toContain('Campus');
        expect(bare.html).not.toContain('Your role');
    });
});
