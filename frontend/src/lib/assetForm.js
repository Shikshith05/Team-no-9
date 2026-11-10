// Add / edit asset form (B23; PWM-F-010 to PWM-F-015, SAD 4.3.3, 4.8).
// The fields of each asset type and their rules match the API
// (backend/src/utils/assetValidation.js, B22), so invalid input is caught here
// with an inline message and never sent. The server still checks everything,
// and its field errors are shown on the same inputs.
import { toPaise } from './money.js';

export const GOLD_FORMS = [
  { value: 'JEWELLERY', label: 'Jewellery' },
  { value: 'COIN', label: 'Coin' },
  { value: 'BAR', label: 'Bar' },
];

export const EXCHANGES = [
  { value: 'NSE', label: 'NSE' },
  { value: 'BSE', label: 'BSE' },
];

// Same pattern as the API: NSE/BSE symbols such as RELIANCE, M&M, BAJAJ-AUTO.
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.&-]{0,19}$/;

// kind: text | money | decimal | date | select | karat | ticker
// intDigits and scale follow the database columns (SAD 4.4).
export const FIELDS = {
  assetName: { label: 'Name', kind: 'text', max: 255 },
  location: { label: 'Location', kind: 'text', max: 255, placeholder: 'e.g. Chennai' },
  purchaseValue: { label: 'Purchase value (₹)', kind: 'money', intDigits: 16 },
  purchaseDate: { label: 'Purchase date', kind: 'date' },
  form: { label: 'Form', kind: 'select', options: GOLD_FORMS },
  purityKarat: { label: 'Purity (karat)', kind: 'karat', hint: 'A whole number from 1 to 24, e.g. 22.' },
  weightGrams: { label: 'Weight (grams)', kind: 'decimal', scale: 3, intDigits: 9, positive: true, hint: 'Up to 3 decimal places.' },
  purchasePrice: { label: 'Purchase price (₹)', kind: 'money', intDigits: 16 },
  ticker: { label: 'Ticker symbol', kind: 'ticker', placeholder: 'e.g. RELIANCE', hint: 'Letters and digits, also &, - and . (up to 20).' },
  exchange: { label: 'Exchange', kind: 'select', options: EXCHANGES },
  quantity: { label: 'Quantity', kind: 'decimal', scale: 4, intDigits: 14, positive: true, hint: 'Number of shares, up to 4 decimal places.' },
  averageBuyPrice: { label: 'Average buy price (₹)', kind: 'money', intDigits: 16 },
  accountLabel: { label: 'Account label', kind: 'text', max: 150, placeholder: 'e.g. HDFC savings' },
  value: { label: 'Current value (₹)', kind: 'money', intDigits: 13 },
};

/**
 * The fields shown for each type, in display order. `required: false` fields may
 * be left empty (gold, stock and cash get a name from their details). Labels can
 * be overridden per type, as the SRS names them (PWM-F-010 to PWM-F-013).
 */
export const TYPE_FIELDS = {
  REAL_ESTATE: [
    { name: 'assetName', label: 'Property name' },
    { name: 'location' },
    { name: 'purchaseValue' },
    { name: 'purchaseDate' },
    { name: 'value', label: 'Current estimated value (₹)' },
  ],
  GOLD: [
    { name: 'form' },
    { name: 'purityKarat' },
    { name: 'weightGrams' },
    { name: 'purchasePrice' },
    { name: 'value', hint: 'What it is worth today. Updated from the daily gold rate when the price feed is set up.' },
    { name: 'assetName', label: 'Name (optional)', required: false },
  ],
  STOCK: [
    { name: 'ticker' },
    { name: 'exchange' },
    { name: 'quantity' },
    { name: 'averageBuyPrice' },
    { name: 'value', hint: 'What the holding is worth today. Updated from the market price when the price feed is set up.' },
    { name: 'assetName', label: 'Name (optional)', required: false },
  ],
  CASH: [
    { name: 'accountLabel' },
    { name: 'value', label: 'Current balance (₹)' },
    { name: 'assetName', label: 'Name (optional)', required: false },
  ],
};

/** The fields of a type with their full definitions: [{ name, label, kind, required, ... }]. */
export function fieldsFor(type) {
  return (TYPE_FIELDS[type] ?? []).map((f) => ({ required: true, ...FIELDS[f.name], ...f }));
}

/** Initial form values: empty for a new asset, or the asset's values when editing. */
export function initialValues(asset) {
  const values = Object.fromEntries(Object.keys(FIELDS).map((name) => [name, '']));
  values.form = 'COIN';
  values.exchange = 'NSE';
  if (!asset) return values;
  for (const name of Object.keys(FIELDS)) {
    const source = name === 'assetName' ? asset.name : name === 'value' ? asset.currentValue : asset[name];
    if (source !== null && source !== undefined) values[name] = String(source);
  }
  return values;
}

// Each check returns { value } (what the API gets) or { error }.

function checkNumber(input, field) {
  const label = field.label.replace(/ \(.*\)$/, '');
  const text = String(input).trim();
  // Money may be typed with ₹ and Indian digit grouping: "₹85,00,000.50".
  const cleaned = text.replace(/^₹\s*/, '').replace(/[,\s]/g, '');
  if (/^-/.test(cleaned)) return { error: `${label} can't be negative.` };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { error: `Enter a number for ${label.toLowerCase()}.` };

  const [whole, fraction = ''] = cleaned.split('.');
  const scale = field.kind === 'money' ? 2 : field.scale;
  if (fraction.length > scale) return { error: `Use at most ${scale} decimal place${scale === 1 ? '' : 's'}.` };
  const digits = whole.replace(/^0+(?=\d)/, '') || '0';
  if (digits.length > field.intDigits) return { error: `${label} is too large.` };
  const value = fraction ? `${digits}.${fraction}` : digits;
  if (field.positive && /^0*(\.0*)?$/.test(value)) return { error: `${label} must be more than 0.` };
  if (field.kind === 'money') return { value: moneyString(value) };
  return { value };
}

// "8500000.5" -> "8500000.50"
function moneyString(value) {
  const paise = toPaise(value);
  return `${paise / 100n}.${(paise % 100n).toString().padStart(2, '0')}`;
}

function checkDate(input, field) {
  const text = String(input).trim();
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(text) && new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);
  return valid ? { value: text } : { error: `${field.label} must be a valid date.` };
}

const CHECKS = {
  text(input, field) {
    const text = String(input).trim();
    if (text.length > field.max) return { error: `Use at most ${field.max} characters.` };
    return { value: text };
  },
  money: checkNumber,
  decimal: checkNumber,
  date: checkDate,
  select(input, field) {
    const value = String(input).trim().toUpperCase();
    return field.options.some((o) => o.value === value) ? { value } : { error: `Choose a ${field.label.toLowerCase()}.` };
  },
  karat(input) {
    const text = String(input).trim().replace(/k$/i, '');
    if (!/^\d{1,2}$/.test(text) || Number(text) < 1 || Number(text) > 24) {
      return { error: 'Enter a whole number of karats from 1 to 24.' };
    }
    return { value: Number(text) };
  },
  ticker(input) {
    const value = String(input).trim().toUpperCase();
    if (!TICKER_PATTERN.test(value)) {
      return { error: 'Use 1 to 20 letters or digits (also &, - or .), like RELIANCE.' };
    }
    return { value };
  },
};

function requiredMessage(field) {
  const label = field.label.replace(/ \(.*\)$/, '').toLowerCase();
  if (field.kind === 'select') return `Choose a ${label}.`;
  return `Enter the ${label}.`;
}

/**
 * Check the form for `type`. Returns { errors: { field: message }, body }.
 * `body` (only when there are no errors) is what POST or PUT /api/assets gets:
 * assetType plus this type's fields, decimals as strings (SAD 4.3.1). An empty
 * optional name is left out on create, and sent as null on edit so the server
 * uses the default name again.
 */
export function validateAssetForm(type, values, { editing = false } = {}) {
  const errors = {};
  const body = { assetType: type };
  for (const field of fieldsFor(type)) {
    const raw = values[field.name] ?? '';
    if (String(raw).trim() === '') {
      if (field.required) errors[field.name] = requiredMessage(field);
      else if (editing) body[field.name] = null;
      continue;
    }
    const result = CHECKS[field.kind](raw, field);
    if (result.error) errors[field.name] = result.error;
    else body[field.name] = result.value;
  }
  return Object.keys(errors).length > 0 ? { errors, body: null } : { errors, body };
}
