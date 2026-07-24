import { describe, expect, it } from 'vitest';
import { Money } from '../src/money';
import { getCurrency, defineCurrency } from '../src/currency';
import { CurrencyMismatchError } from '../src/errors';

const USD = getCurrency('USD');
const EUR = getCurrency('EUR');

const usd = (major: string) => Money.of(major, USD);

describe('additive arithmetic', () => {
  it('add sums same-currency amounts', () => {
    expect(usd('10.50').add(usd('4.25')).equals(usd('14.75'))).toBe(true);
  });

  it('subtract can go negative', () => {
    expect(usd('4.00').subtract(usd('10.00')).equals(usd('-6.00'))).toBe(true);
  });

  it('add/subtract throw across currencies', () => {
    expect(() => usd('1.00').add(Money.of('1.00', EUR))).toThrow(CurrencyMismatchError);
    expect(() => usd('1.00').subtract(Money.of('1.00', EUR))).toThrow(CurrencyMismatchError);
  });

  it('negate flips the sign', () => {
    expect(usd('3.07').negate().equals(usd('-3.07'))).toBe(true);
    expect(usd('-3.07').negate().equals(usd('3.07'))).toBe(true);
  });

  it('abs is never negative', () => {
    expect(usd('-3.07').abs().equals(usd('3.07'))).toBe(true);
    expect(usd('3.07').abs().equals(usd('3.07'))).toBe(true);
  });

  it('operations are immutable (operands unchanged)', () => {
    const a = usd('10.00');
    const b = usd('3.00');
    a.add(b);
    a.subtract(b);
    a.negate();
    expect(a.amount).toBe(1000n);
    expect(b.amount).toBe(300n);
  });
});

describe('comparison', () => {
  it('compare returns -1 / 0 / 1', () => {
    expect(usd('1.00').compare(usd('2.00'))).toBe(-1);
    expect(usd('2.00').compare(usd('2.00'))).toBe(0);
    expect(usd('3.00').compare(usd('2.00'))).toBe(1);
  });

  it('greaterThan / lessThan', () => {
    expect(usd('3.00').greaterThan(usd('2.00'))).toBe(true);
    expect(usd('1.00').lessThan(usd('2.00'))).toBe(true);
    expect(usd('2.00').greaterThan(usd('2.00'))).toBe(false);
  });

  it('compare/greaterThan/lessThan throw across currencies', () => {
    const eur = Money.of('1.00', EUR);
    expect(() => usd('1.00').compare(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd('1.00').greaterThan(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd('1.00').lessThan(eur)).toThrow(CurrencyMismatchError);
  });

  it('same code but different exponent is not interchangeable', () => {
    const usd3 = Money.fromMinor(1000n, defineCurrency('USD', 3));
    expect(usd('1.00').equals(usd3)).toBe(false);
    expect(() => usd('1.00').add(usd3)).toThrow(CurrencyMismatchError);
  });

  it('sign predicates', () => {
    expect(usd('0').isZero()).toBe(true);
    expect(usd('-1.00').isNegative()).toBe(true);
    expect(usd('1.00').isPositive()).toBe(true);
    expect(usd('0').isNegative()).toBe(false);
    expect(usd('0').isPositive()).toBe(false);
  });
});
