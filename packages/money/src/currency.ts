import { InvalidCurrencyError } from './errors';

/**
 * A currency: an ISO 4217 code plus its minor-unit exponent (how many decimal
 * digits the currency subdivides into — USD=2 cents, JPY=0, BHD=3).
 *
 * VARIATION POINT: the exponent table below is a static subset today. When the
 * Country Configuration Registry exists, currency metadata graduates to it
 * (additive change — see the design pattern). Consumers depend on the `Currency`
 * shape, not on where the table lives, so that move stays non-breaking.
 */
export interface Currency {
  /** ISO 4217 alphabetic code, e.g. "USD". */
  readonly code: string;
  /** Minor-unit exponent: number of decimal places, e.g. 2 for USD, 0 for JPY. */
  readonly exponent: number;
}

/** Minor-unit exponents for the currencies Wave-1 needs. Extend as required. */
const EXPONENTS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  NGN: 2,
  GHS: 2,
  KES: 2,
  ZAR: 2,
  JPY: 0,
  BHD: 3,
  KWD: 3,
};

/** Look up a known currency by ISO 4217 code. Throws if the code is unknown. */
export function getCurrency(code: string): Currency {
  const exponent = EXPONENTS[code];
  if (exponent === undefined) {
    throw new InvalidCurrencyError(code);
  }
  return { code, exponent };
}

/**
 * Define a currency explicitly (for codes not in the static table). Prefer
 * `getCurrency` for known codes; this exists so callers aren't blocked on the
 * table before it graduates to the Country Configuration Registry.
 */
export function defineCurrency(code: string, exponent: number): Currency {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new InvalidCurrencyError(code, `exponent must be a non-negative integer, got ${exponent}`);
  }
  return { code, exponent };
}

/** Two currencies are equal when their codes match. */
export function currenciesEqual(a: Currency, b: Currency): boolean {
  return a.code === b.code;
}
