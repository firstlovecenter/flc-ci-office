// Universal (browser + server) money formatter.
// No dependency on Prisma or any decimal library — operates on the string
// representation of the number to avoid IEEE-754 drift.

type FormatInput = string | number | { toString(): string } | null | undefined;

function toRawString(value: FormatInput): string {
    if (value === null || value === undefined || value === '') return '0';
    if (typeof value === 'string') return value.trim() === '' ? '0' : value.trim();
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return '0';
        // Number.toString already produces an exact decimal for finite numbers
        // up to ~15-17 significant digits; for stored monetary precision this
        // is acceptable because the canonical source is the server string.
        return value.toString();
    }
    // Decimal-like object (Prisma.Decimal, BigNumber, etc.) — call toString.
    return String(value);
}

/**
 * Format a stored monetary value for display.
 *
 * Rule: always show at least `minDecimals` fraction digits, never truncate
 * stored precision.
 *   1234         -> "1,234.00"
 *   1234.5       -> "1,234.50"
 *   1234.567     -> "1,234.567"
 *   "999.9999998" -> "999.9999998"
 */
export function formatMoney(value: FormatInput, minDecimals: number = 2): string {
    let raw = toRawString(value);

    // Reject anything that isn't a plain decimal numeral.
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        // Last-resort: try Number then back to string. Loses precision but
        // beats throwing in display code.
        const n = Number(raw);
        if (!Number.isFinite(n)) return '0.' + '0'.repeat(minDecimals);
        raw = n.toString();
    }

    const negative = raw.startsWith('-');
    if (negative) raw = raw.slice(1);

    let [intPart, fracPart = ''] = raw.split('.');
    // Strip leading zeros except keep one
    intPart = intPart.replace(/^0+(?=\d)/, '');
    if (intPart === '') intPart = '0';

    // Pad fraction to minDecimals; keep extra digits as-is.
    if (fracPart.length < minDecimals) {
        fracPart = fracPart.padEnd(minDecimals, '0');
    }

    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = negative ? '-' : '';
    return fracPart ? `${sign}${withCommas}.${fracPart}` : `${sign}${withCommas}`;
}

/**
 * Round a number to 2 decimal places, removing IEEE-754 drift introduced by
 * client-side money arithmetic (e.g. accumulating a running balance). Safe for
 * all app magnitudes, which are far below 2^53 cents.
 */
export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Sum money values exactly by accumulating integer cents, so a long list of
 * amounts never produces a drifted total like 221616.6399999999.
 */
export function sumMoney(values: Array<number | string | null | undefined>): number {
    const cents = values.reduce<number>((acc, v) => acc + Math.round(Number(v ?? 0) * 100), 0);
    return cents / 100;
}
