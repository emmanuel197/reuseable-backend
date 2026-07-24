import { describe, expect, it } from 'vitest';
import { Money } from '../src/money';
import { getCurrency } from '../src/currency';
import { InvalidAmountError } from '../src/errors';

const USD = getCurrency('USD');
const usd = (major: string) => Money.of(major, USD);
const minor = (units: bigint) => Money.fromMinor(units, USD);

describe('multiply', () => {
  it('scales by an integer factor exactly', () => {
    expect(usd('10.00').multiply(3).equals(usd('30.00'))).toBe(true);
  });

  it('scales by a decimal factor', () => {
    expect(usd('10.00').multiply('0.2').equals(usd('2.00'))).toBe(true);
    expect(usd('99.99').multiply(2).equals(usd('199.98'))).toBe(true);
  });

  it('handles negative factors', () => {
    expect(usd('10.00').multiply('-1.5').equals(usd('-15.00'))).toBe(true);
  });

  it('rounds half-even (banker’s) by default', () => {
    // 2.5c -> 2c, 3.5c -> 4c (round to even)
    expect(minor(5n).multiply('0.5').amount).toBe(2n);
    expect(minor(7n).multiply('0.5').amount).toBe(4n);
  });

  it('respects an explicit rounding mode', () => {
    expect(minor(5n).multiply('0.5', 'half-up').amount).toBe(3n);
    expect(minor(5n).multiply('0.5', 'down').amount).toBe(2n);
    expect(minor(-5n).multiply('0.5', 'ceil').amount).toBe(-2n);
    expect(minor(-5n).multiply('0.5', 'floor').amount).toBe(-3n);
  });

  it('rejects a non-numeric factor', () => {
    expect(() => usd('1.00').multiply('x')).toThrow(InvalidAmountError);
  });
});

describe('allocate', () => {
  it('splits evenly when it divides cleanly', () => {
    const parts = usd('10.00').allocate([1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([500n, 500n]);
  });

  it('distributes leftover pennies, largest ratio first, and conserves the total', () => {
    const parts = usd('0.05').allocate([1, 1, 1]); // 5c / 3
    expect(parts.map((p) => p.amount)).toEqual([2n, 2n, 1n]);
    const sum = parts.reduce((acc, p) => acc + p.amount, 0n);
    expect(sum).toBe(5n);
  });

  it('awards the leftover by largest fractional remainder (true LRM)', () => {
    // 6c by 4:3 — exact shares 3.43c / 2.57c; the extra cent goes to the larger
    // fractional remainder (0.57, the w=3 bucket), giving [3, 3] not [4, 2].
    const parts = minor(6n).allocate([4, 3]);
    expect(parts.map((p) => p.amount)).toEqual([3n, 3n]);
    expect(parts[0].amount + parts[1].amount).toBe(6n);
  });

  it('weights the split and still conserves the total', () => {
    const parts = usd('1.00').allocate([2, 1]); // 100c by 2:1
    expect(parts.map((p) => p.amount)).toEqual([67n, 33n]);
    expect(parts[0].amount + parts[1].amount).toBe(100n);
  });

  it('conserves the total for negative amounts', () => {
    const parts = usd('-0.05').allocate([1, 1, 1]);
    const sum = parts.reduce((acc, p) => acc + p.amount, 0n);
    expect(sum).toBe(-5n);
  });

  it('allows zero-weight buckets (they receive nothing)', () => {
    const parts = usd('0.10').allocate([1, 0, 1]);
    expect(parts.map((p) => p.amount)).toEqual([5n, 0n, 5n]);
  });

  it('rejects empty, all-zero, or non-integer ratios', () => {
    expect(() => usd('1.00').allocate([])).toThrow(InvalidAmountError);
    expect(() => usd('1.00').allocate([0, 0])).toThrow(InvalidAmountError);
    expect(() => usd('1.00').allocate([1.5, 1])).toThrow(InvalidAmountError);
    expect(() => usd('1.00').allocate([-1, 2])).toThrow(InvalidAmountError);
  });

  it('is immutable (source amount unchanged)', () => {
    const source = usd('1.00');
    source.allocate([1, 1, 1]);
    expect(source.amount).toBe(100n);
  });
});
