import { type Currency, assertValidExponent, currenciesEqual } from './currency';
import { CurrencyMismatchError, InvalidAmountError, InvalidCurrencyError } from './errors';

/** JSON shape: self-contained (carries the currency), so round-trips exactly. */
export interface MoneyJSON {
  /** Minor units as a base-10 string (bigint is not JSON-native). */
  readonly amount: string;
  readonly currency: Currency;
}

/**
 * An immutable amount of money: exact minor units (`bigint`) in a single
 * `Currency`. Never floats. All operations return new instances.
 */
export class Money {
  private constructor(
    /** Signed amount in the currency's minor units (e.g. cents). */
    readonly amount: bigint,
    readonly currency: Currency,
  ) {}

  /** Build from raw minor units (e.g. `1050n` = $10.50). */
  static fromMinor(minorUnits: bigint, currency: Currency): Money {
    return new Money(minorUnits, currency);
  }

  /**
   * Build from a major amount — a decimal number or string (e.g. `10.5` or
   * `"10.50"` USD → `1050n`). Rejects more fractional digits than the currency
   * allows, since that cannot be represented exactly (no silent rounding here).
   *
   * ⚠️ Prefer a **string** for computed amounts. A `number` is stringified as-is,
   * so a float-arithmetic result (e.g. `0.1 + 0.2` → `0.30000000000000004`) will
   * throw `InvalidAmountError` rather than silently round. The `number` overload
   * is safe for exact literals like `1000` or `10.5`.
   */
  static of(amount: number | string, currency: Currency): Money {
    return new Money(parseMajorToMinor(amount, currency.exponent), currency);
  }

  /** Same currency and same minor amount. Differing currencies are simply not equal. */
  equals(other: Money): boolean {
    return currenciesEqual(this.currency, other.currency) && this.amount === other.amount;
  }

  /** Sum of two same-currency amounts. Throws `CurrencyMismatchError` across currencies. */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  /** Difference of two same-currency amounts. Throws `CurrencyMismatchError` across currencies. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  /** The additive inverse (same magnitude, opposite sign). */
  negate(): Money {
    return new Money(-this.amount, this.currency);
  }

  /** The absolute value (never negative). */
  abs(): Money {
    return new Money(this.amount < 0n ? -this.amount : this.amount, this.currency);
  }

  /** `-1`, `0`, or `1` — this vs other. Throws `CurrencyMismatchError` across currencies. */
  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  /** True when this amount is strictly greater than other (same currency). */
  greaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  /** True when this amount is strictly less than other (same currency). */
  lessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  /** True when the amount is exactly zero. */
  isZero(): boolean {
    return this.amount === 0n;
  }

  /** True when the amount is below zero. */
  isNegative(): boolean {
    return this.amount < 0n;
  }

  /** True when the amount is above zero. */
  isPositive(): boolean {
    return this.amount > 0n;
  }

  private assertSameCurrency(other: Money): void {
    if (!currenciesEqual(this.currency, other.currency)) {
      throw new CurrencyMismatchError(this.currency.code, other.currency.code);
    }
  }

  /** Self-contained JSON (`amount` as string, plus the currency). */
  toJSON(): MoneyJSON {
    return { amount: this.amount.toString(), currency: this.currency };
  }

  /** Rebuild from {@link toJSON} output. Exact round-trip; validates untrusted input. */
  static fromJSON(json: MoneyJSON): Money {
    let minorUnits: bigint;
    try {
      minorUnits = BigInt(json.amount);
    } catch {
      throw new InvalidAmountError(String(json.amount), 'amount must be an integer string');
    }
    if (json.currency === null || typeof json.currency !== 'object') {
      throw new InvalidCurrencyError(String(json.currency), 'currency must be an object');
    }
    if (typeof json.currency.code !== 'string' || json.currency.code.length === 0) {
      throw new InvalidCurrencyError(String(json.currency.code), 'currency code must be a non-empty string');
    }
    assertValidExponent(json.currency.code, json.currency.exponent);
    return new Money(minorUnits, json.currency);
  }

  /** Canonical debug string, e.g. `"10.50 USD"`. NOT locale formatting. */
  toString(): string {
    return `${minorToDecimalString(this.amount, this.currency.exponent)} ${this.currency.code}`;
  }
}

/** Convert a major decimal amount to exact minor units, or throw on precision loss. */
function parseMajorToMinor(amount: number | string, exponent: number): bigint {
  const raw = typeof amount === 'string' ? amount.trim() : amount.toString();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new InvalidAmountError(raw, 'not a decimal number');
  }

  const negative = raw.startsWith('-');
  const [intPart, fracPart = ''] = raw.replace('-', '').split('.');
  if (fracPart.length > exponent) {
    throw new InvalidAmountError(raw, `more than ${exponent} fractional digit(s) for this currency`);
  }

  const minorDigits = intPart + fracPart.padEnd(exponent, '0');
  const magnitude = BigInt(minorDigits);
  return negative ? -magnitude : magnitude;
}

/** Render signed minor units as a plain decimal string (debug/serialization helper). */
function minorToDecimalString(minorUnits: bigint, exponent: number): string {
  const negative = minorUnits < 0n;
  const digits = (negative ? -minorUnits : minorUnits).toString().padStart(exponent + 1, '0');
  const cut = digits.length - exponent;
  const intPart = digits.slice(0, cut);
  const fracPart = exponent > 0 ? `.${digits.slice(cut)}` : '';
  return `${negative ? '-' : ''}${intPart}${fracPart}`;
}
