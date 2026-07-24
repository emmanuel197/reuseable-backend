/**
 * Rounding modes for `Money.multiply`. `half-even` (banker's rounding) is the
 * default — it minimises cumulative bias across many operations, which is why
 * finance and IEEE-754 both prefer it.
 */
export type RoundingMode =
  | 'half-even'
  | 'half-up'
  | 'half-down'
  | 'up'
  | 'down'
  | 'ceil'
  | 'floor';

/**
 * Divide `numerator` by `denominator` (an exact rational) and round the result
 * to an integer per `mode`. Operates on magnitudes and reapplies the sign, so
 * `up`/`down` mean away-from/toward zero and `ceil`/`floor` mean +∞/−∞.
 */
export function divideWithRounding(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode,
): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  let quotient = absNum / absDen;
  const remainder = absNum % absDen;
  if (remainder === 0n) {
    return negative ? -quotient : quotient;
  }

  const twiceRemainder = remainder * 2n;
  let roundAwayFromZero: boolean;
  switch (mode) {
    case 'down':
      roundAwayFromZero = false;
      break;
    case 'up':
      roundAwayFromZero = true;
      break;
    case 'floor':
      roundAwayFromZero = negative;
      break;
    case 'ceil':
      roundAwayFromZero = !negative;
      break;
    case 'half-up':
      roundAwayFromZero = twiceRemainder >= absDen;
      break;
    case 'half-down':
      roundAwayFromZero = twiceRemainder > absDen;
      break;
    case 'half-even':
      if (twiceRemainder > absDen) roundAwayFromZero = true;
      else if (twiceRemainder < absDen) roundAwayFromZero = false;
      else roundAwayFromZero = quotient % 2n === 1n;
      break;
  }

  if (roundAwayFromZero) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}
