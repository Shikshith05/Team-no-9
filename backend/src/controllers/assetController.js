const pool = require("../config/db");
const { notFound, validationError } = require("../utils/errors");

// Errors are thrown and turned into the SAD error format by errorHandler
// (src/utils/errors.js). Input is validated here so that bad requests get
// 400 VALIDATION_ERROR with field messages instead of a database error.

const MAX_VALUE = 9999999999999.99; // assets.value is NUMERIC(15, 2)
const MAX_INT_ID = 2147483647; // assets.id is SERIAL (INT)

const assetNotFound = () => notFound("Asset not found.");

// A positive integer id, or throw 404 (a malformed id cannot match an asset).
function parseAssetId(raw) {
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 1 || Number(raw) > MAX_INT_ID) throw assetNotFound();
  return Number(raw);
}

function checkText(fields, field, value, label, maxLength, required) {
  if (value === undefined || value === null) {
    if (required) fields.push({ field, message: `${label} is required.` });
    return;
  }
  if (typeof value !== "string" || value.trim() === "") {
    fields.push({ field, message: `${label} must not be empty.` });
  } else if (value.trim().length > maxLength) {
    fields.push({ field, message: `${label} must be at most ${maxLength} characters.` });
  }
}

function checkValue(fields, field, value, required) {
  if (value === undefined || value === null || value === "") {
    if (required) fields.push({ field, message: "Value is required." });
    return;
  }
  const number = Number(value);
  if (typeof value === "boolean" || !Number.isFinite(number)) {
    fields.push({ field, message: "Value must be a number." });
  } else if (number < 0) {
    fields.push({ field, message: "Value cannot be negative." });
  } else if (number > MAX_VALUE) {
    fields.push({ field, message: "Value is too large." });
  } else if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
    fields.push({ field, message: "Value can have at most 2 decimal places." });
  }
}

function checkDate(fields, field, value) {
  if (value === undefined || value === null || value === "") return;
  const valid =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid) fields.push({ field, message: "Purchase date must be a valid date (YYYY-MM-DD)." });
}

// Story #9: Create Asset (Strictly req.user.id)
exports.createAsset = async (req, res) => {
  const { assetName, assetType, value, purchaseDate } = req.body;
  const userId = req.user.id; // Strictly from authenticated token

  const fields = [];
  checkText(fields, "assetName", assetName, "Asset name", 255, true);
  checkText(fields, "assetType", assetType, "Asset type", 100, true);
  checkValue(fields, "value", value, true);
  checkDate(fields, "purchaseDate", purchaseDate);
  if (fields.length > 0) throw validationError(fields);

  const query = `
    INSERT INTO assets (user_id, asset_name, asset_type, value, purchase_date)
    VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE))
    RETURNING *;
  `;
  const result = await pool.query(query, [
    userId,
    assetName.trim(),
    assetType.trim(),
    Number(value),
    purchaseDate || null
  ]);

  res.status(201).json({ success: true, data: result.rows[0] });
};

// Story #8: Update Asset (Strictly req.user.id & active assets)
exports.updateAsset = async (req, res) => {
  const id = parseAssetId(req.params.id);
  const { assetName, assetType, value } = req.body;
  const userId = req.user.id;

  const fields = [];
  checkText(fields, "assetName", assetName, "Asset name", 255, false);
  checkText(fields, "assetType", assetType, "Asset type", 100, false);
  checkValue(fields, "value", value, false);
  if (fields.length > 0) throw validationError(fields);

  const query = `
    UPDATE assets
    SET asset_name = COALESCE($1, asset_name),
        asset_type = COALESCE($2, asset_type),
        value = COALESCE($3, value),
        updated_at = NOW()
    WHERE id = $4 AND user_id = $5 AND deleted_at IS NULL
    RETURNING *;
  `;
  const result = await pool.query(query, [
    assetName == null ? null : assetName.trim(),
    assetType == null ? null : assetType.trim(),
    value == null || value === "" ? null : Number(value),
    id,
    userId
  ]);

  // Another user's asset looks exactly like a missing one.
  if (result.rows.length === 0) throw assetNotFound();

  res.status(200).json({ success: true, data: result.rows[0] });
};

// Story #8 & SAD: Soft Delete Asset (Sets deleted_at timestamp)
exports.deleteAsset = async (req, res) => {
  const id = parseAssetId(req.params.id);
  const userId = req.user.id;

  const query = `
    UPDATE assets
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    RETURNING id;
  `;
  const result = await pool.query(query, [id, userId]);

  if (result.rows.length === 0) throw assetNotFound();

  res.status(200).json({ success: true, message: "Asset soft-deleted successfully" });
};

// Story #22: Aggregation for Active Assets Only
exports.getDashboardSummary = async (req, res) => {
  const userId = req.user.id;
  const startTime = Date.now();

  const query = `
    SELECT
      asset_type,
      SUM(value) AS total_value,
      COUNT(*) AS count
    FROM assets
    WHERE user_id = $1 AND deleted_at IS NULL
    GROUP BY asset_type;
  `;
  const result = await pool.query(query, [userId]);
  const totalNetWorth = result.rows.reduce((sum, row) => sum + parseFloat(row.total_value || 0), 0);
  const executionTimeMs = Date.now() - startTime;

  res.status(200).json({
    success: true,
    executionTimeMs,
    totalNetWorth,
    allocation: result.rows
  });
};

module.exports.parseAssetId = parseAssetId;
module.exports.checkValue = checkValue;
