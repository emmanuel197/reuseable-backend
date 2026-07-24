/** Thrown when an operation mixes two different currencies. */
export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: cannot operate on ${a} and ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

/** Thrown when a currency code is unknown or its definition is invalid. */
export class InvalidCurrencyError extends Error {
  constructor(code: string, detail?: string) {
    super(detail ? `Invalid currency ${code}: ${detail}` : `Unknown currency: ${code}`);
    this.name = 'InvalidCurrencyError';
  }
}

/** Thrown when an amount cannot be parsed into exact minor units. */
export class InvalidAmountError extends Error {
  constructor(amount: string, detail: string) {
    super(`Invalid amount "${amount}": ${detail}`);
    this.name = 'InvalidAmountError';
  }
}
