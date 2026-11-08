// Asset input rules per asset class (B22).
//   PWM-F-010 real estate: property name, location, purchase value, purchase date,
//             current estimated value
//   PWM-F-011 gold: form (jewellery/coin/bar), purity, weight in grams, purchase price
//   PWM-F-012 stock: ticker symbol, quantity, average buy price
//   PWM-F-013 cash/bank: account label, current balance
//   PWM-F-015 data types and non-negative numbers (TC-Asset-02)
// Type names, gold forms, purity 1-24 karat and the column types come from
// SAD 4.3.3 and 4.4. Money, quantity and weight may be sent as decimal strings
// (SAD 4.3.1) or JSON numbers (older clients); they are stored as NUMERIC.
//
// `value` is the asset's current value as entered by the user, for every type
// (the real estate "current estimated value", the cash "current balance", and
// the starting value of stock and gold until the market refresh revalues them;
// PWM-F-020/021 are not part of B22).
//
// frontend/src/lib/assetForm.js applies the same rules in the browser.

const ASSET_TYPES = ["REAL_ESTATE", "GOLD", "STOCK", "CASH"];
const GOLD_FORMS = ["JEWELLERY", "COIN", "BAR"];
const EXCHANGES = ["NSE", "BSE"];
// NSE/BSE symbols: letters and digits, plus "&", "-" and "." (M&M, BAJAJ-AUTO).
// SRS AC-PWM-F-012 also asks for a lookup against known symbols; there is no
// symbol master yet (SAD instruments table), so only the format is checked.
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.&-]{0,19}$/;

// API field -> column and rule. intDigits/scale follow the column type.
const FIELDS = {
  assetName: { column: "asset_name", label: "Asset name", kind: "text", max: 255 },
  location: { column: "location", label: "Location", kind: "text", max: 255 },
  purchaseValue: { column: "purchase_value", label: "Purchase value", kind: "decimal", scale: 2, intDigits: 16 },
  form: { column: "form", label: "Form", kind: "choice", choices: GOLD_FORMS },
  purityKarat: { column: "purity_karat", label: "Purity", kind: "karat" },
  weightGrams: { column: "weight_grams", label: "Weight", kind: "decimal", scale: 3, intDigits: 9, positive: true },
  purchasePrice: { column: "purchase_price", label: "Purchase price", kind: "decimal", scale: 2, intDigits: 16 },
  ticker: { column: "ticker", label: "Ticker", kind: "ticker" },
  exchange: { column: "exchange", label: "Exchange", kind: "choice", choices: EXCHANGES },
  quantity: { column: "quantity", label: "Quantity", kind: "decimal", scale: 4, intDigits: 14, positive: true },
  averageBuyPrice: { column: "average_buy_price", label: "Average buy price", kind: "decimal", scale: 2, intDigits: 16 },
  accountLabel: { column: "account_label", label: "Account label", kind: "text", max: 150 },
  // assets.value is NUMERIC(15, 2)
  value: { column: "value", label: "Value", kind: "decimal", scale: 2, intDigits: 13 },
  purchaseDate: { column: "purchase_date", label: "Purchase date", kind: "date" }
};

// Errors are listed in this order.
const FIELD_ORDER = Object.keys(FIELDS);

const TYPE_RULES = {
  REAL_ESTATE: { required: ["assetName", "location", "purchaseValue", "purchaseDate", "value"], optional: [] },
  GOLD: { required: ["form", "purityKarat", "weightGrams", "purchasePrice", "value"], optional: ["assetName", "purchaseDate"] },
  STOCK: { required: ["ticker", "quantity", "averageBuyPrice", "value"], optional: ["assetName", "exchange", "purchaseDate"] },
  CASH: { required: ["accountLabel", "value"], optional: ["assetName", "purchaseDate"] }
};

// Columns that only some types use. Fields of other types are stored as NULL.
const DETAIL_COLUMNS = Object.values(FIELDS)
  .map((spec) => spec.column)
  .filter((column) => !["asset_name", "value", "purchase_date"].includes(column));

const isMissing = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** "gold", " Gold " -> "GOLD"; anything that is not one of the four types -> null. */
function normalizeAssetType(raw) {
  if (typeof raw !== "string") return null;
  const type = raw.trim().toUpperCase();
  return ASSET_TYPES.includes(type) ? type : null;
}

// Each check returns { value } (normalized, ready for the database) or { error }.
const checks = {
  text(raw, spec) {
    if (typeof raw !== "string") return { error: `${spec.label} must be text.` };
    const text = raw.trim();
    if (text.length > spec.max) return { error: `${spec.label} must be at most ${spec.max} characters.` };
    return { value: text };
  },

  decimal(raw, spec) {
    if (typeof raw === "boolean" || !["string", "number"].includes(typeof raw) || !Number.isFinite(Number(raw))) {
      return { error: `${spec.label} must be a number.` };
    }
    const text = String(raw).trim();
    const number = Number(text);
    if (number < 0) return { error: `${spec.label} cannot be negative.` };
    if (spec.positive && number === 0) return { error: `${spec.label} must be more than 0.` };
    if (number >= 10 ** spec.intDigits) return { error: `${spec.label} is too large.` };
    // Number() also accepts "1e3", "0x10" and " .5"; the database value must be plain.
    const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) return { error: `${spec.label} must be a number.` };
    if ((match[2] || "").length > spec.scale) {
      return { error: `${spec.label} can have at most ${spec.scale} decimal places.` };
    }
    return { value: text };
  },

  date(raw, spec) {
    const valid =
      typeof raw === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
      !Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) &&
      new Date(`${raw}T00:00:00Z`).toISOString().startsWith(raw);
    return valid ? { value: raw } : { error: `${spec.label} must be a valid date (YYYY-MM-DD).` };
  },

  choice(raw, spec) {
    const value = typeof raw === "string" ? raw.trim().toUpperCase() : null;
    if (!spec.choices.includes(value)) {
      return { error: `${spec.label} must be one of ${spec.choices.join(", ")}.` };
    }
    return { value };
  },

  // SAD 4.4: purity in karat, 1 to 24 (TC-Gold-01 tries 0 and 25). "22K" is accepted.
  karat(raw, spec) {
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim().replace(/k$/i, "") : "";
    if (!/^\d{1,2}$/.test(text) || Number(text) < 1 || Number(text) > 24) {
      return { error: `${spec.label} must be a whole number of karats from 1 to 24.` };
    }
    return { value: Number(text) };
  },

  ticker(raw, spec) {
    const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (!TICKER_PATTERN.test(value)) {
      return { error: `${spec.label} must be 1 to 20 letters or digits (also "&", "-" or "."), like RELIANCE.` };
    }
    return { value };
  }
};

// Stocks, gold and cash have no SRS "name" field, so one is made from their details.
function defaultName(type, row) {
  if (type === "STOCK") return row.ticker;
  if (type === "CASH") return row.account_label;
  if (type === "GOLD") return `Gold ${row.form.toLowerCase()} (${row.purity_karat}K)`;
  return null;
}

/**
 * Validate a complete asset (a POST body, or the stored asset merged with a PUT
 * body). Returns { fields: [{ field, message }], row }. `row` has a value for
 * asset_type, asset_name, value, purchase_date and every detail column; columns
 * that do not apply to the type are null.
 */
function validateAsset(input) {
  const fields = [];
  const row = {};
  const type = normalizeAssetType(input.assetType);

  let typeError = null;
  if (isMissing(input.assetType)) typeError = "Asset type is required.";
  else if (!type) typeError = `Asset type must be one of ${ASSET_TYPES.join(", ")}.`;

  // Without a valid type only the fields every type has can be checked.
  const rule = type ? TYPE_RULES[type] : { required: ["value"], optional: ["assetName", "purchaseDate"] };
  const allowed = new Set([...rule.required, ...rule.optional]);

  // assetName first, then assetType, then the rest in FIELD_ORDER.
  for (const field of ["assetName", "assetType", ...FIELD_ORDER.slice(1)]) {
    if (field === "assetType") {
      if (typeError) fields.push({ field, message: typeError });
      continue;
    }
    if (!allowed.has(field)) continue;

    const spec = FIELDS[field];
    const raw = input[field];
    if (isMissing(raw)) {
      if (rule.required.includes(field)) fields.push({ field, message: `${spec.label} is required.` });
      // A present but blank name is an error, not "use the default".
      else if (field === "assetName" && typeof raw === "string") {
        fields.push({ field, message: "Asset name must not be empty." });
      }
      continue;
    }
    const result = checks[spec.kind](raw, spec);
    if (result.error) fields.push({ field, message: result.error });
    else row[spec.column] = result.value;
  }

  if (fields.length > 0 || !type) return { fields, row: null };

  for (const column of DETAIL_COLUMNS) {
    if (!(column in row)) row[column] = null;
  }
  if (type === "STOCK" && !row.exchange) row.exchange = "NSE"; // SAD 4.3.3 example
  row.asset_type = type;
  row.asset_name = row.asset_name || defaultName(type, row);
  row.purchase_date = row.purchase_date || null;
  return { fields, row };
}

module.exports = {
  ASSET_TYPES,
  GOLD_FORMS,
  EXCHANGES,
  FIELDS,
  TYPE_RULES,
  DETAIL_COLUMNS,
  normalizeAssetType,
  validateAsset
};
