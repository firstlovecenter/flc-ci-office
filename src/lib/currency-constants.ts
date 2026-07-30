/**
 * App currency is hardcoded to Ghana Cedis (GHS).
 * Safe for client and server — no DB access here.
 */
export const APP_CURRENCY = {
  code: 'GHS',
  name: 'Ghana Cedi',
  symbol: '₵',
} as const;
