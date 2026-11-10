// B23: the asset form rules match the API (B22, backend/src/utils/assetValidation.js).
import { describe, expect, it } from 'vitest';
import { fieldsFor, initialValues, validateAssetForm } from './assetForm.js';

const names = (type) => fieldsFor(type).map((f) => f.name);

describe('fields per asset type (PWM-F-010 to PWM-F-013)', () => {
  it('shows the SRS fields of each type', () => {
    expect(names('REAL_ESTATE')).toEqual(['assetName', 'location', 'purchaseValue', 'purchaseDate', 'value']);
    expect(names('GOLD')).toEqual(['form', 'purityKarat', 'weightGrams', 'purchasePrice', 'value', 'assetName']);
    expect(names('STOCK')).toEqual(['ticker', 'exchange', 'quantity', 'averageBuyPrice', 'value', 'assetName']);
    expect(names('CASH')).toEqual(['accountLabel', 'value', 'assetName']);
  });

  it('the name is required only for real estate', () => {
    const required = (type) => fieldsFor(type).find((f) => f.name === 'assetName').required;
    expect(required('REAL_ESTATE')).toBe(true);
    expect(['GOLD', 'STOCK', 'CASH'].map(required)).toEqual([false, false, false]);
  });
});

describe('market-valued types (B26, PWM-F-020, PWM-F-021)', () => {
  it('the value hint for gold and stocks says the price feed updates it', () => {
    const hint = (type) => fieldsFor(type).find((f) => f.name === 'value').hint;
    expect(hint('GOLD')).toMatch(/gold rate/);
    expect(hint('STOCK')).toMatch(/market price/);
    expect([hint('GOLD'), hint('STOCK')].join(' ')).not.toMatch(/not automatic/);
  });
});

describe('validateAssetForm', () => {
  it('builds the API body: decimal strings, money with 2 decimals, upper-case ticker', () => {
    const values = { ...initialValues(), ticker: ' infy ', quantity: '12.5', averageBuyPrice: '₹1,450.5', value: '17,400' };
    expect(validateAssetForm('STOCK', values)).toEqual({
      errors: {},
      body: { assetType: 'STOCK', ticker: 'INFY', exchange: 'NSE', quantity: '12.5', averageBuyPrice: '1450.50', value: '17400.00' },
    });
  });

  it('gold: purity is a number; a blank optional name is left out on create and null on edit', () => {
    const values = { ...initialValues(), form: 'BAR', purityKarat: '24', weightGrams: '10', purchasePrice: '60000', value: '70000' };
    const created = validateAssetForm('GOLD', values);
    expect(created.body).toEqual({
      assetType: 'GOLD',
      form: 'BAR',
      purityKarat: 24,
      weightGrams: '10',
      purchasePrice: '60000.00',
      value: '70000.00',
    });
    expect(validateAssetForm('GOLD', values, { editing: true }).body.assetName).toBeNull();
  });

  it('lists every missing required field', () => {
    expect(validateAssetForm('REAL_ESTATE', initialValues()).errors).toEqual({
      assetName: 'Enter the property name.',
      location: 'Enter the location.',
      purchaseValue: 'Enter the purchase value.',
      purchaseDate: 'Enter the purchase date.',
      value: 'Enter the current estimated value.',
    });
    expect(validateAssetForm('CASH', initialValues()).errors).toEqual({
      accountLabel: 'Enter the account label.',
      value: 'Enter the current balance.',
    });
  });

  it('rejects what the API rejects (TC-Gold-01, TC-Stock-01, TC-Asset-02)', () => {
    const gold = { ...initialValues(), form: 'COIN', purityKarat: '25', weightGrams: '-1', purchasePrice: '1.234', value: 'abc' };
    expect(validateAssetForm('GOLD', gold).errors).toEqual({
      purityKarat: 'Enter a whole number of karats from 1 to 24.',
      weightGrams: "Weight can't be negative.",
      purchasePrice: 'Use at most 2 decimal places.',
      value: 'Enter a number for current value.',
    });
    expect(validateAssetForm('GOLD', { ...gold, purityKarat: '0', weightGrams: '0', purchasePrice: '1', value: '1' }).errors).toEqual({
      purityKarat: 'Enter a whole number of karats from 1 to 24.',
      weightGrams: 'Weight must be more than 0.',
    });

    const stock = { ...initialValues(), ticker: 'RELI ANCE', quantity: '1.00001', averageBuyPrice: '1', value: '99999999999999' };
    expect(validateAssetForm('STOCK', stock).errors).toEqual({
      ticker: 'Use 1 to 20 letters or digits (also &, - or .), like RELIANCE.',
      quantity: 'Use at most 4 decimal places.',
      value: 'Current value is too large.',
    });

    const cash = { ...initialValues(), accountLabel: 'a'.repeat(151), value: '10' };
    expect(validateAssetForm('CASH', cash).errors).toEqual({ accountLabel: 'Use at most 150 characters.' });

    const property = { ...initialValues(), assetName: 'Flat', location: 'Pune', purchaseValue: '1', purchaseDate: '2021-02-30', value: '1' };
    expect(validateAssetForm('REAL_ESTATE', property).errors).toEqual({ purchaseDate: 'Purchase date must be a valid date.' });
  });
});

describe('initialValues', () => {
  it('prefills an existing asset for editing', () => {
    const asset = {
      id: 7,
      assetType: 'GOLD',
      name: 'Necklace',
      currentValue: '225000.00',
      form: 'JEWELLERY',
      purityKarat: 22,
      weightGrams: '35.500',
      purchasePrice: '180000.00',
      location: null,
    };
    expect(initialValues(asset)).toMatchObject({
      assetName: 'Necklace',
      value: '225000.00',
      form: 'JEWELLERY',
      purityKarat: '22',
      weightGrams: '35.500',
      purchasePrice: '180000.00',
      location: '',
    });
  });
});
