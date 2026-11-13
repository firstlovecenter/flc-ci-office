import { Prisma } from '@prisma/client';

/** Largest value the Decimal(14,2) amount columns can hold. */
const MAX_AMOUNT = new Prisma.Decimal('999999999999.99');

export type AmountResult = { ok: true; value: Prisma.Decimal } | { ok: false; error: string };

/**
 * Validate a client-supplied money amount: a finite number (or numeric
 * string) that is > 0, has at most 2 decimal places and fits the column.
 * Run this before any type-based rule so a negative/zero/NaN value can never
 * reach the ledger or flip a balance.
 */
export function parsePositiveAmount(raw: unknown, label = 'Amount'): AmountResult {
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') {
        return { ok: false, error: `${label} is required` };
    }
    if (typeof raw !== 'number' && typeof raw !== 'string') {
        return { ok: false, error: `${label} must be a number` };
    }
    if (typeof raw === 'number' && !Number.isFinite(raw)) {
        return { ok: false, error: `${label} must be a valid number` };
    }
    let dec: Prisma.Decimal;
    try {
        dec = new Prisma.Decimal(typeof raw === 'string' ? raw.trim() : raw);
    } catch {
        return { ok: false, error: `${label} must be a valid number` };
    }
    if (!dec.isFinite()) return { ok: false, error: `${label} must be a valid number` };
    if (!dec.gt(0)) return { ok: false, error: `${label} must be greater than zero` };
    if (dec.decimalPlaces() > 2) {
        return { ok: false, error: `${label} can have at most 2 decimal places` };
    }
    if (dec.gt(MAX_AMOUNT)) return { ok: false, error: `${label} is too large` };
    return { ok: true, value: dec };
}

/** Free-text description cap shared by transaction create/edit and SMS bodies. */
export const MAX_DESCRIPTION_LENGTH = 500;

export function truncateForSms(text: string, max = 60): string {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
