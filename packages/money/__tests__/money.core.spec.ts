import { describe, expect, it } from 'vitest';
import { Money } from '../src/money';
import { getCurrency, defineCurrency, currenciesEqual } from '../src/currency';
import { InvalidAmountError, InvalidCurrencyError } from '../src/errors';

const USD = getCurrency('USD');
const JPY = getCurrency('JPY');

describe('Currency', () => {
  it('knows minor-unit exponents', () => {
    expect(USD.exponent).toBe(2);
    expect(JPY.exponent).toBe(0);
    expect(getCurrency('BHD').exponent).toBe(3);
  });

  it('throws on an unknown code', () => {
    expect(() => getCurrency('ZZZ')).toThrow(InvalidCurrencyError);
  });

  it('defineCurrency rejects a negative exponent', () => {
    expect(() => defineCurrency('XTS', -1)).toThrow(InvalidCurrencyError);
  });

  it('currenciesEqual compares by code', () => {
    expect(currenciesEqual(USD, getCurrency('USD'))).toBe(true);
    expect(currenciesEqual(USD, JPY)).toBe(false);
  });
});

describe('Money construction', () => {
  it('of() converts a major decimal to exact minor units', () => {
    expect(Money.of('10.50', USD).amount).toBe(1050n);
    expect(Money.of(10.5, USD).amount).toBe(1050n);
    expect(Money.of('10', USD).amount).toBe(1000n);
    expect(Money.of(1000, JPY).amount).toBe(1000n);
    expect(Money.of('-3.07', USD).amount).toBe(-307n);
  });

  it('fromMinor() takes raw minor units', () => {
    expect(Money.fromMinor(1050n, USD).amount).toBe(1050n);
  });

  it('of() rejects excess fractional precision (no silent rounding)', () => {
    expect(() => Money.of('10.505', USD)).toThrow(InvalidAmountError);
    expect(() => Money.of('1.5', JPY)).toThrow(InvalidAmountError);
  });

  it('of() rejects non-numeric input', () => {
    expect(() => Money.of('abc', USD)).toThrow(InvalidAmountError);
  });
});

describe('Money equality', () => {
  it('is true for same currency and amount', () => {
    expect(Money.of('10.50', USD).equals(Money.fromMinor(1050n, USD))).toBe(true);
  });

  it('is false for different amount or currency', () => {
    expect(Money.of('10.50', USD).equals(Money.of('10.51', USD))).toBe(false);
    expect(Money.fromMinor(1050n, USD).equals(Money.fromMinor(1050n, JPY))).toBe(false);
  });
});

describe('Money serialization', () => {
  it('toJSON/fromJSON round-trips exactly', () => {
    const original = Money.of('1234.56', USD);
    const restored = Money.fromJSON(original.toJSON());
    expect(restored.equals(original)).toBe(true);
    expect(original.toJSON().amount).toBe('123456');
  });

  it('survives a JSON.stringify/parse cycle', () => {
    const original = Money.fromMinor(-99n, JPY);
    const restored = Money.fromJSON(JSON.parse(JSON.stringify(original)));
    expect(restored.equals(original)).toBe(true);
  });

  it('toString renders a canonical decimal', () => {
    expect(Money.of('10.5', USD).toString()).toBe('10.50 USD');
    expect(Money.fromMinor(1000n, JPY).toString()).toBe('1000 JPY');
    expect(Money.fromMinor(-307n, USD).toString()).toBe('-3.07 USD');
  });
});
