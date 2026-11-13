import { describe, it, expect } from 'vitest';
import { parsePositiveAmount, truncateForSms } from './amount-validation';

describe('parsePositiveAmount', () => {
  it.each([-1, 0, '0', '-5.00', NaN, Infinity, '1e999x', 'abc', 1.005, '1.234', null, undefined, '', true, {}, 1e15])(
    'rejects %s', (v) => expect(parsePositiveAmount(v as never).ok).toBe(false));
  it.each([0.01, 1, '12.50', 999999999999.99])('accepts %s', (v) => expect(parsePositiveAmount(v).ok).toBe(true));
});

describe('truncateForSms', () => {
  it('caps length', () => expect(truncateForSms('a'.repeat(500), 60).length).toBe(60));
});
