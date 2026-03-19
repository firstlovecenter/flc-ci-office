import { describe, it, expect } from 'vitest';
import { convertCurrency } from '@/lib/currency-conversion';

// Mock exchange rate rows (shape matches what Prisma returns)
const mockRates = [
    {
        fromCurrency: { id: 'USD' },
        toCurrency: { id: 'GHS' },
        rate: '14.5',
    },
    {
        fromCurrency: { id: 'EUR' },
        toCurrency: { id: 'USD' },
        rate: '1.08',
    },
];

describe('convertCurrency', () => {
    it('returns original amount when currencies are the same', () => {
        expect(convertCurrency(100, 'USD', 'USD', mockRates)).toBe(100);
    });

    it('converts using a direct exchange rate', () => {
        const result = convertCurrency(100, 'USD', 'GHS', mockRates);
        expect(result).toBeCloseTo(1450);
    });

    it('converts using reverse exchange rate', () => {
        // GHS→USD: reverse of USD→GHS (14.5), so 145 GHS = ~10 USD
        const result = convertCurrency(145, 'GHS', 'USD', mockRates);
        expect(result).toBeCloseTo(10, 1);
    });

    it('returns original amount when no exchange rate exists', () => {
        const result = convertCurrency(100, 'GHS', 'EUR', mockRates);
        expect(result).toBe(100);
    });

    it('handles zero amount', () => {
        expect(convertCurrency(0, 'USD', 'GHS', mockRates)).toBe(0);
    });
});
