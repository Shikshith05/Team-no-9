import { describe, expect, it } from 'vitest';
import { MAX_PROPERTY_VALUE, validateAmount } from './validation.js';

describe('TC-Val-03 / PWM-F-022: new property value', () => {
  it('rejects an empty value', () => {
    expect(validateAmount('')).toEqual({ error: 'Enter the new value.' });
    expect(validateAmount('   ')).toEqual({ error: 'Enter the new value.' });
    expect(validateAmount(undefined)).toEqual({ error: 'Enter the new value.' });
  });

  it('rejects negative values', () => {
    expect(validateAmount('-100')).toEqual({ error: "The value can't be negative." });
    expect(validateAmount('-0.50')).toEqual({ error: "The value can't be negative." });
    expect(validateAmount('-85,00,000')).toEqual({ error: "The value can't be negative." });
  });

  it('rejects text and other non-numbers', () => {
    for (const input of ['abc', '12abc', '1e5', '1.2.3', '.', '+500', '₹', '85 lakh', 'NaN', 'Infinity']) {
      expect(validateAmount(input).error, input).toBe('Enter a number, like 8500000 or 85,00,000.50.');
    }
  });

  it('rejects more than 2 decimal places', () => {
    expect(validateAmount('12.345')).toEqual({ error: 'Use at most 2 decimal places.' });
    expect(validateAmount('8500000.001')).toEqual({ error: 'Use at most 2 decimal places.' });
  });

  it('rejects values above the ₹1,000 crore limit', () => {
    expect(validateAmount('10000000000.01').error).toBe('Enter a value no more than ₹1,000 crore.');
    expect(validateAmount('99999999999').error).toMatch(/no more than/);
    expect(validateAmount(MAX_PROPERTY_VALUE)).toEqual({ value: '10000000000.00' });
  });

  it('accepts valid amounts and returns the API decimal string', () => {
    expect(validateAmount('8500000')).toEqual({ value: '8500000.00' });
    expect(validateAmount('8500000.5')).toEqual({ value: '8500000.50' });
    expect(validateAmount('85,00,000.50')).toEqual({ value: '8500000.50' });
    expect(validateAmount('8,500,000')).toEqual({ value: '8500000.00' });
    expect(validateAmount(' ₹ 85,00,000 ')).toEqual({ value: '8500000.00' });
    expect(validateAmount('0')).toEqual({ value: '0.00' });
    expect(validateAmount('007')).toEqual({ value: '7.00' });
    expect(validateAmount('5.')).toEqual({ value: '5.00' });
    expect(validateAmount('.75')).toEqual({ value: '0.75' });
  });
});
