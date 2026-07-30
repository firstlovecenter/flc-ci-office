/**
 * Server-side Ghana Cedis helpers.
 */
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/format-money';
import { APP_CURRENCY } from '@/lib/currency-constants';

export { APP_CURRENCY } from '@/lib/currency-constants';

export type AppCurrency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isActive: boolean;
};

let cachedGhs: AppCurrency | null = null;

/** Ensure the GHS row exists and return it (cached per process). */
export async function getAppCurrency(): Promise<AppCurrency> {
  if (cachedGhs) return cachedGhs;

  let ghs = await prisma.currency.findFirst({
    where: { code: 'GHS' },
  });

  if (!ghs) {
    ghs = await prisma.currency.create({
      data: {
        id: crypto.randomUUID(),
        code: APP_CURRENCY.code,
        name: APP_CURRENCY.name,
        symbol: APP_CURRENCY.symbol,
        isBase: true,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  } else if (!ghs.isBase || !ghs.isActive) {
    ghs = await prisma.currency.update({
      where: { id: ghs.id },
      data: { isBase: true, isActive: true, symbol: APP_CURRENCY.symbol, name: APP_CURRENCY.name },
    });
  }

  cachedGhs = {
    id: ghs.id,
    code: ghs.code,
    name: ghs.name,
    symbol: ghs.symbol,
    isBase: true,
    isActive: true,
  };
  return cachedGhs;
}

export function formatGhs(amount: number | string): string {
  return `${APP_CURRENCY.symbol}${formatMoney(amount)}`;
}
