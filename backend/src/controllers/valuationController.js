const pool = require("../config/db");
const { validationError } = require("../utils/errors");

const MAX_INT_ID = 2147483647;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;

function isValidDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  );
}

function parsePositiveInt(fields, field, raw, fallback, max) {
  if (raw === undefined) return fallback;

  if (
    typeof raw !== "string" ||
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1
  ) {
    fields.push({
      field,
      message: `${field} must be a positive whole number.`
    });
    return fallback;
  }

  if (max && Number(raw) > max) {
    fields.push({
      field,
      message: `${field} must be at most ${max}.`
    });
    return fallback;
  }

  return Number(raw);
}

// GET /api/valuations/history
// Optional filters: assetId, from, to, page, limit.
// Legacy rows are excluded because they have no verified unified asset owner.
exports.getHistory = async (req, res) => {
  const fields = [];
  const { assetId, from, to } = req.query;

  const page = parsePositiveInt(
    fields,
    "page",
    req.query.page,
    DEFAULT_PAGE
  );

  const limit = parsePositiveInt(
    fields,
    "limit",
    req.query.limit,
    DEFAULT_LIMIT,
    MAX_LIMIT
  );

  if (assetId !== undefined) {
    if (
      typeof assetId !== "string" ||
      !/^\d+$/.test(assetId) ||
      Number(assetId) < 1 ||
      Number(assetId) > MAX_INT_ID
    ) {
      fields.push({
        field: "assetId",
        message: "assetId must be a positive whole number."
      });
    }
  }

  if (from !== undefined && !isValidDate(from)) {
    fields.push({
      field: "from",
      message: "from must be a valid date (YYYY-MM-DD)."
    });
  }

  if (to !== undefined && !isValidDate(to)) {
    fields.push({
      field: "to",
      message: "to must be a valid date (YYYY-MM-DD)."
    });
  }

  if (
    from !== undefined &&
    to !== undefined &&
    isValidDate(from) &&
    isValidDate(to) &&
    from > to
  ) {
    fields.push({
      field: "to",
      message: "to must be on or after from."
    });
  }

  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    fields.push({
      field: "page",
      message: "page is too large."
    });
  }

  if (fields.length > 0) {
    throw validationError(fields);
  }

  const conditions = [
    "a.user_id = $1",
    "a.deleted_at IS NULL",
    "v.asset_id IS NOT NULL"
  ];

  const params = [req.user.id];

  if (assetId !== undefined) {
    params.push(Number(assetId));
    conditions.push(`a.id = $${params.length}`);
  }

  if (from !== undefined) {
    params.push(from);
    conditions.push(`v.valued_at >= $${params.length}::date`);
  }

  if (to !== undefined) {
    params.push(to);
    conditions.push(
      `v.valued_at < ($${params.length}::date + INTERVAL '1 day')`
    );
  }

  const where = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::INTEGER AS total
     FROM valuations v
     INNER JOIN assets a ON a.id = v.asset_id
     WHERE ${where}`,
    params
  );

  const result = await pool.query(
    `SELECT
       v.id,
       v.asset_id::INTEGER AS "assetId",
       UPPER(a.asset_type) AS "assetType",
       a.asset_name AS "assetName",
       v.value::TEXT AS value,
       v.unit_price::TEXT AS "unitPrice",
       v.source,
       TO_CHAR(
         v.valued_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
       ) AS "valuedAt"
     FROM valuations v
     INNER JOIN assets a ON a.id = v.asset_id
     WHERE ${where}
     ORDER BY v.valued_at DESC, v.id DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.status(200).json({
    items: result.rows,
    page,
    limit,
    total: countResult.rows[0].total
  });
};