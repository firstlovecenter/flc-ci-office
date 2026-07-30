import { APP_CURRENCY } from '@/lib/currency-constants';
import { toDecimal, type Money, type MoneyInput } from './money';
import { getAppCurrency } from './currency';

/** Always Ghana Cedis. organisationId is ignored (kept for call-site compatibility). */
export async function getOrganisationBaseCurrency(_organisationId?: string) {
  return getAppCurrency();
}

/** @deprecated Always Ghana Cedis. */
export async function getUserBaseCurrency(_userId?: string) {
  return getAppCurrency();
}

/** Identity conversion — amounts are already GHS. */
export function convertCurrency(
  amount: MoneyInput,
  _fromCurrencyId?: string,
  _toCurrencyId?: string,
  _exchangeRates?: any[],
): Money {
  return toDecimal(amount);
}

/** @deprecated Identity conversion. */
export function convertToUserBaseCurrency(
  amount: MoneyInput,
  _fromCurrencyId?: string,
  _userBaseCurrencyId?: string,
  _exchangeRates?: any[],
): Money {
  return toDecimal(amount);
}

export { APP_CURRENCY };
