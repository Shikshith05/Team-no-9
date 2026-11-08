const pool = require("../config/db");
const { notFound, unprocessable, validationError } = require("../utils/errors");
const { DETAIL_COLUMNS, FIELDS, validateAsset } = require("../utils/assetValidation");

// Errors are thrown and turned into the SAD error format by errorHandler
// (src/utils/errors.js). Input is validated here so that bad requests get
// 400 VALIDATION_ERROR with field messages instead of a database error.

const MAX_INT_ID = 2147483647; // assets.id is SERIAL (INT)

const assetNotFound = () => notFound("Asset not found.");

// A positive integer id, or throw 404 (a malformed id cannot match an asset).
function parseAssetId(raw) {
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 1 || Number(raw) > MAX_INT_ID) throw assetNotFound();
  return Number(raw);
}

// B22: the columns a create or update writes, in a fixed order.
const WRITE_COLUMNS = ["asset_type", "asset_name", "value", "purchase_date", ...DETAIL_COLUMNS];

// Body fields that PUT may change. Anything else in the body is ignored.
const EDITABLE_FIELDS = ["assetType", ...Object.keys(FIELDS)];

// The stored asset in the request's field names, so a PUT body can be merged over it.
const STORED_AS_INPUT = `
  asset_type AS "assetType",
  asset_name AS "assetName",
  value::TEXT AS value,
  TO_CHAR(purchase_date, 'YYYY-MM-DD') AS "purchaseDate",
  location,
  purchase_value::TEXT AS "purchaseValue",
  form,
  purity_karat AS "purityKarat",
  weight_grams::TEXT AS "weightGrams",
  purchase_price::TEXT AS "purchasePrice",
  ticker,
  exchange,
  quantity::TEXT AS quantity,
  average_buy_price::TEXT AS "averageBuyPrice",
  account_label AS "accountLabel"
`;

// POST /api/assets (PWM-F-010 to PWM-F-013, PWM-F-015; SAD 4.3.3). assetType
// selects the required fields (utils/assetValidation.js). The owner is always
// the caller. Response shape unchanged: 201 { success, data: <assets row> }.
exports.createAsset = async (req, res) => {
  const userId = req.user.id; // Strictly from authenticated token

  const { fields, row } = validateAsset(req.body || {});
  if (fields.length > 0) throw validationError(fields);

  const placeholders = WRITE_COLUMNS.map((column, i) =>
    column === "purchase_date" ? `COALESCE($${i + 2}::DATE, CURRENT_DATE)` : `$${i + 2}`
  );
  const result = await pool.query(
    `INSERT INTO assets (user_id, ${WRITE_COLUMNS.join(", ")})
     VALUES ($1, ${placeholders.join(", ")})
     RETURNING *`,
    [userId, ...WRITE_COLUMNS.map((column) => row[column])]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
};

// PUT /api/assets/:id (PWM-F-014). Partial update: fields left out keep their
// stored value, and the result must be a complete, valid asset of its (possibly
// new) type, so an asset created before B22 has to be completed on its first
// edit. Changing the type clears the fields of the old type. Only the caller's
// non-deleted assets can be changed; another user's asset is 404.
// The value change is not written to `valuations` here (SAD 4.5 asks for it);
// only PUT /api/assets/:id/valuation records history. See docs/bug-log.md, B22.
exports.updateAsset = async (req, res) => {
  const id = parseAssetId(req.params.id);
  const userId = req.user.id;
  const body = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT ${STORED_AS_INPUT} FROM assets
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [id, userId]
    );
    // Another user's asset looks exactly like a missing one.
    if (current.rows.length === 0) throw assetNotFound();

    const merged = { ...current.rows[0] };
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) merged[field] = body[field];
    }

    const { fields, row } = validateAsset(merged);
    if (fields.length > 0) throw validationError(fields);

    const assignments = WRITE_COLUMNS.map((column, i) =>
      column === "purchase_date" ? `purchase_date = COALESCE($${i + 1}::DATE, purchase_date)` : `${column} = $${i + 1}`
    );
    const n = WRITE_COLUMNS.length;
    const result = await client.query(
      `UPDATE assets
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${n + 1} AND user_id = $${n + 2} AND deleted_at IS NULL
       RETURNING *`,
      [...WRITE_COLUMNS.map((column) => row[column]), id, userId]
    );

    await client.query("COMMIT");
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
// valuedAt is the row's updated_at (when the asset last changed).
// assetType is returned upper case (REAL_ESTATE, as the frontend expects) and
// the ?type= filter ignores case, because rows that migration 010 could not map
// keep their old spelling.
// B22: the per-type fields follow SAD 4.3.3; a field that does not apply to the
// asset's type is null. Money and weight are decimal strings; quantity drops
// trailing zeros ("10", as in the SAD example); purityKarat is a number.
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50; // SAD 4.3.1: page/limit default 1 and 50, max 200
const MAX_PAGE_SIZE = 200;
const MAX_MANUAL_VALUE = "10000000000.00"; // ₹1,000 crore, as in the frontend contract
const MARKET_VALUED_TYPES = new Set(["STOCK", "GOLD"]); // refreshed from price feeds

const ASSET_COLUMNS = `
  id,
  UPPER(asset_type) AS "assetType",
  asset_name AS name,
  location,
  purchase_value::TEXT AS "purchaseValue",
  TO_CHAR(purchase_date, 'YYYY-MM-DD') AS "purchaseDate",
  value::TEXT AS "currentValue",
  TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "valuedAt",
  form,
  purity_karat::INT AS "purityKarat",
  weight_grams::TEXT AS "weightGrams",
  purchase_price::TEXT AS "purchasePrice",
  ticker,
  exchange,
  TRIM_SCALE(quantity)::TEXT AS quantity,
  average_buy_price::TEXT AS "averageBuyPrice",
  account_label AS "accountLabel"
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