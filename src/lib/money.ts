// Server-only Decimal arithmetic. Do not import from client components —
// this pulls in Prisma.Decimal which is not part of the browser bundle.
import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
export type Money = Prisma.Decimal;
export type MoneyInput = Prisma.Decimal | number | string | null | undefined;

export function toDecimal(value: MoneyInput): Money {
    if (value === null || value === undefined || value === '') return new D(0);
    if (value instanceof D) return value;
    return new D(value);
}

export function sumDecimals(values: MoneyInput[]): Money {
    return values.reduce<Money>((acc, v) => acc.plus(toDecimal(v)), new D(0));
}

export function gt(a: MoneyInput, b: MoneyInput): boolean {
    return toDecimal(a).gt(toDecimal(b));
}

export function gte(a: MoneyInput, b: MoneyInput): boolean {
    return toDecimal(a).gte(toDecimal(b));
}

export function lt(a: MoneyInput, b: MoneyInput): boolean {
    return toDecimal(a).lt(toDecimal(b));
}

export function lte(a: MoneyInput, b: MoneyInput): boolean {
    return toDecimal(a).lte(toDecimal(b));
}

export function eq(a: MoneyInput, b: MoneyInput): boolean {
    return toDecimal(a).eq(toDecimal(b));
}

export function isPositive(a: MoneyInput): boolean {
    return toDecimal(a).gt(0);
}

/**
 * Serialize a Decimal to an exact decimal string for transport over JSON.
 * Never coerces through JS Number, so no precision is lost.
 */
export function moneyToString(value: MoneyInput): string {
    return toDecimal(value).toFixed();
}
