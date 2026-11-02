const pool = require("../config/db");
const { notFound, unprocessable, validationError } = require("../utils/errors");

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

// ---------------------------------------------------------------------------
// B5 (#54): read and manual-valuation endpoints, matching the contract in
// frontend/src/api/assets.js (field names, pagination, decimal strings).
//
// The unified `assets` table has no location or purchase value, so those are
// null; valuedAt is the row's updated_at (when the value last changed).
// assetType is returned upper case (REAL_ESTATE, as the frontend expects) and
// the ?type= filter ignores case, because existing rows use both spellings.
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50; // SAD 4.3.1: page/limit default 1 and 50, max 200
const MAX_PAGE_SIZE = 200;
const MAX_MANUAL_VALUE = "10000000000.00"; // ₹1,000 crore, as in the frontend contract
const MARKET_VALUED_TYPES = new Set(["STOCK", "GOLD"]); // refreshed from price feeds

const ASSET_COLUMNS = `
  id,
  UPPER(asset_type) AS "assetType",
  asset_name AS name,
  NULL::TEXT AS location,
  NULL::TEXT AS "purchaseValue",
  TO_CHAR(purchase_date, 'YYYY-MM-DD') AS "purchaseDate",
  value::TEXT AS "currentValue",
  TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "valuedAt"
`;

function parsePositiveInt(fields, field, raw, fallback, max) {
  if (raw === undefined) return fallback;
  const text = String(raw);
  if (!/^\d+$/.test(text) || Number(text) < 1) {
    fields.push({ field, message: `${field} must be a positive whole number.` });
    return fallback;
  }
  if (max && Number(text) > max) {
    fields.push({ field, message: `${field} must be at most ${max}.` });
    return fallback;
  }
  return Number(text);
}

// GET /api/assets?type=&page=&limit=  -> { items, page, limit, total }
exports.listAssets = async (req, res) => {
  const userId = req.user.id;
  const fields = [];
  const page = parsePositiveInt(fields, "page", req.query.page, 1);
  const limit = parsePositiveInt(fields, "limit", req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const type = req.query.type;
  if (type !== undefined && (typeof type !== "string" || type.trim() === "" || type.length > 100)) {
    fields.push({ field: "type", message: "type must be a non-empty asset type." });
  }
  if (fields.length > 0) throw validationError(fields);

  const filters = ["user_id = $1", "deleted_at IS NULL"];
  const params = [userId];
  if (type !== undefined) {
    params.push(type.trim());
    filters.push(`UPPER(asset_type) = UPPER($${params.length})`);
  }
  const where = filters.join(" AND ");

  const total = await pool.query(`SELECT COUNT(*)::INT AS total FROM assets WHERE ${where}`, params);
  const items = await pool.query(
    `SELECT ${ASSET_COLUMNS} FROM assets WHERE ${where}
     ORDER BY id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  res.status(200).json({ items: items.rows, page, limit, total: total.rows[0].total });
};

// GET /api/assets/:id -> one asset. Another user's asset is 404, like a
// missing one, so the response never confirms that the id exists.
exports.getAsset = async (req, res) => {
  const id = parseAssetId(req.params.id);
  const result = await pool.query(
    `SELECT ${ASSET_COLUMNS} FROM assets WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, req.user.id]
  );
  if (result.rows.length === 0) throw assetNotFound();
  res.status(200).json(result.rows[0]);
};

// PUT /api/assets/:id/valuation  body { value: "8500000.00" }
// Sets a new manual value and returns the updated asset.
// PUT /api/assets/:id/valuation
// Updates the asset's manual value and records its valuation history.
// Both operations happen in the same database transaction.
// PUT /api/assets/:id/valuation
// Updates the asset's manual value and records its history
// in the same database transaction.
exports.updateValuation = async (req, res) => {
  const id = parseAssetId(req.params.id);
  const userId = req.user.id;
  const { value } = req.body;

  const text = typeof value === "number" ? String(value) : value;

  const valid =
    typeof text === "string" &&
    /^\d+(\.\d{1,2})?$/.test(text.trim()) &&
    Number(text) <= Number(MAX_MANUAL_VALUE);

  if (!valid) {
    throw validationError(
      [
        {
          field: "value",
          message:
            "must be an amount from 0 to 10000000000.00 with at most 2 decimals"
        }
      ],
      "Check the highlighted field."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT
         asset_type,
         UPPER(asset_type) AS type
       FROM assets
       WHERE id = $1
         AND user_id = $2
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id, userId]
    );

    if (current.rows.length === 0) {
      throw assetNotFound();
    }

    if (MARKET_VALUED_TYPES.has(current.rows[0].type)) {
      throw unprocessable(
        "MARKET_VALUED",
        "This asset is valued from market prices."
      );
    }

    const updated = await client.query(
      `UPDATE assets
       SET value = $1,
           updated_at = NOW()
       WHERE id = $2
         AND user_id = $3
       RETURNING ${ASSET_COLUMNS}`,
      [text.trim(), id, userId]
    );

    // Record the manual valuation against the unified assets table.
    await client.query(
      `INSERT INTO valuations
         (asset_type, asset_id, value, source, valued_at)
       VALUES ($1, $2, $3, 'MANUAL', NOW())`,
      [current.rows[0].asset_type, id, text.trim()]
    );

    await client.query("COMMIT");

    res.status(200).json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};