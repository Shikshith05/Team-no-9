// Form validation. The backend applies the same rules (SAD 3.9: schema
// validation on every request); doing it here as well gives instant inline
// feedback and means invalid input is never sent.
import { fromPaise, toPaise } from './money.js';

/** Highest estimated value accepted for one property: ₹1,000 crore. */
export const MAX_PROPERTY_VALUE = '10000000000.00';

/**
 * Check a rupee amount typed by the user. Digit-grouping commas, spaces and a
 * leading ₹ are allowed ("₹85,00,000.50"). Returns { value: "8500000.50" }, a
 * plain decimal string ready for the API, or { error: "message" }.
 */
export function validateAmount(input, { max = MAX_PROPERTY_VALUE, maxLabel = '₹1,000 crore' } = {}) {
  const text = String(input ?? '').trim();
  if (text === '') return { error: 'Enter the new value.' };

  const cleaned = text.replace(/^₹\s*/, '').replace(/[,\s]/g, '');
  if (cleaned.startsWith('-') && isPlainNumber(cleaned.slice(1))) {
    return { error: "The value can't be negative." };
  }
  if (!isPlainNumber(cleaned)) return { error: 'Enter a number, like 8500000 or 85,00,000.50.' };

  const [whole, fraction = ''] = cleaned.split('.');
  if (fraction.length > 2) return { error: 'Use at most 2 decimal places.' };

  const paise = toPaise(`${whole || '0'}${fraction ? `.${fraction}` : ''}`);
  if (paise > toPaise(max)) return { error: `Enter a value no more than ${maxLabel}.` };
  return { value: fromPaise(paise) };
}

// Digits with an optional decimal point: "85", "85.5", "85." and ".5" are fine.
function isPlainNumber(text) {
  return /^(\d+\.?\d*|\.\d+)$/.test(text);
}
