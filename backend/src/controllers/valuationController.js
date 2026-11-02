const pool = require("../config/db");
const { validationError } = require("../utils/errors");

const MAX_INT_ID = 2147483647;

function isValidDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  );
}

// GET /api/valuations/history
// Optional query parameters:
//   assetId = positive asset ID
//   from    = inclusive start date (YYYY-MM-DD)
//   to      = inclusive end date (YYYY-MM-DD)
//
// Legacy valuation rows are excluded because they have no verified
// relationship to a unified asset or its owner.
exports.getHistory = async (req, res) => {
  const fields = [];
  const { assetId, from, to } = req.query;

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
     WHERE ${conditions.join(" AND ")}
     ORDER BY v.valued_at DESC, v.id DESC`,
    params
  );

  res.status(200).json({ items: result.rows });
};