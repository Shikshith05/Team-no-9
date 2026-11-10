const pool = require("../config/db");
const { validationError } = require("../utils/errors");
const { buildAllocation } = require("../utils/allocation");

// B11 (#61): the two endpoints frontend/src/api/dashboard.js calls.
// Every query is limited to the caller's non-deleted assets (PRJ-SR-004).

// Rows use more than one spelling ("real_estate", "REAL_ESTATE", "cash_bank"),
// so they are grouped under the names the frontend knows.
const ASSET_CLASS = `
  CASE UPPER(asset_type) WHEN 'CASH_BANK' THEN 'CASH' ELSE UPPER(asset_type) END
`;

// GET /api/dashboard (PWM-F-030, PWM-F-031, SAD 4.3.3)
exports.getDashboard = async (req, res) => {
  const userId = req.user.id;

  const classes = await pool.query(
    `SELECT ${ASSET_CLASS} AS "assetType", SUM(value)::NUMERIC(18, 2)::TEXT AS value
     FROM assets
     WHERE user_id = $1 AND deleted_at IS NULL
     GROUP BY 1`,
    [userId]
  );

  // PWM-F-024 (SAD 4.5): true when the latest refresh of a price the user's own
  // holdings use has failed. B26: the refresh writes price_cache, one row per
  // instrument (services/marketRefresh.js). The old market_price_cache (keyed by
  // the per-type tables, which have no owner, so only matchable by class) is no
  // longer written but is still honoured for rows left from before.
  const stale = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM assets a
       JOIN price_cache p ON p.instrument_key = CASE UPPER(a.asset_type)
         WHEN 'STOCK' THEN 'STOCK:' || COALESCE(a.exchange, 'NSE') || ':' || a.ticker
         WHEN 'GOLD' THEN 'GOLD:' || a.purity_karat || 'K'
       END
       WHERE a.user_id = $1 AND a.deleted_at IS NULL AND p.last_status = 'FAILED'
     ) OR EXISTS (
       SELECT 1
       FROM assets a
       JOIN market_price_cache c ON c.asset_type = LOWER(a.asset_type)
       WHERE a.user_id = $1 AND a.deleted_at IS NULL AND c.is_stale
     ) AS "hasStaleData"`,
    [userId]
  );

  const { netWorth, allocation } = buildAllocation(classes.rows);

  res.status(200).json({
    netWorth,
    currency: "INR",
    asOf: new Date().toISOString(),
    hasStaleData: stale.rows[0].hasStaleData,
    allocation
  });
};

const TREND_RANGES = { "1M": "1 month", "6M": "6 months", "1Y": "12 months", ALL: null };

// One row per IST day, oldest first (PWM-F-032, TC-Dash-03).
//
// The series is worked out from `valuations` on each request, rather than read
// from the net_worth_snapshots table in the SAD. This needs no new table or job,
// and history already recorded shows up straight away.
//   - Today uses assets.value, so the last point always equals netWorth from
//     GET /api/dashboard.
//   - Earlier days use the asset's latest valuation up to the end of that day.
//   - Days before its first valuation use that first valuation. The value the
//     asset was created with is not recorded anywhere, so this is the closest known.
//   - An asset counts from the day it was created or first valued, whichever is
//     earlier. purchase_date is not used, because nothing is known about the
//     asset's value between its purchase and being added to the app.
//   - A soft-deleted asset is left out of every day, and legacy valuation rows
//     (asset_id IS NULL) have no verified owner, so they never match.
const TREND_SQL = `
  WITH today AS (
    SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE AS day
  ),
  owned AS (
    SELECT a.id,
           a.value,
           first_valuation.value AS first_value,
           LEAST(
             (a.created_at AT TIME ZONE 'Asia/Kolkata')::DATE,
             first_valuation.day,
             today.day
           ) AS first_day
    FROM assets a
    CROSS JOIN today
    LEFT JOIN LATERAL (
      SELECT v.value, (v.valued_at AT TIME ZONE 'Asia/Kolkata')::DATE AS day
      FROM valuations v
      WHERE v.asset_id = a.id
      ORDER BY v.valued_at, v.id
      LIMIT 1
    ) first_valuation ON TRUE
    WHERE a.user_id = $1 AND a.deleted_at IS NULL
  ),
  days AS (
    SELECT generate_series(
             GREATEST(MIN(owned.first_day), (today.day - $2::INTERVAL)::DATE)::TIMESTAMP,
             today.day::TIMESTAMP,
             INTERVAL '1 day'
           )::DATE AS day
    FROM owned
    CROSS JOIN today
    GROUP BY today.day
  )
  SELECT TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
         SUM(
           CASE WHEN days.day = today.day THEN owned.value
                ELSE COALESCE(latest.value, owned.first_value, owned.value)
           END
         )::NUMERIC(18, 2)::TEXT AS "netWorth"
  FROM days
  CROSS JOIN today
  JOIN owned ON owned.first_day <= days.day
  LEFT JOIN LATERAL (
    SELECT v.value
    FROM valuations v
    WHERE v.asset_id = owned.id
      AND v.valued_at < ((days.day + 1)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
    ORDER BY v.valued_at DESC, v.id DESC
    LIMIT 1
  ) latest ON days.day <> today.day
  GROUP BY days.day
  ORDER BY days.day
`;

// GET /api/dashboard/trend?range=1M|6M|1Y|ALL
exports.getTrend = async (req, res) => {
  const { range } = req.query;

  if (typeof range !== "string" || !Object.hasOwn(TREND_RANGES, range)) {
    throw validationError([{ field: "range", message: "range must be 1M, 6M, 1Y or ALL." }]);
  }

  const result = await pool.query(TREND_SQL, [req.user.id, TREND_RANGES[range]]);

  res.status(200).json({ range, currency: "INR", points: result.rows });
};
