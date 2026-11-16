const pool = require("../config/db");

// Alerts target a user's combined stock or gold portfolio value, as selected in
// the dashboard form. Trigger once, after a complete successful refresh for
// that category. Persisting the trigger makes repeated refreshes idempotent.
async function evaluatePortfolioAlerts(assetType) {
  if (!["stock", "gold"].includes(assetType)) {
    throw new Error("Unsupported alert asset type");
  }

  const dbAssetType = assetType.toUpperCase();
  const result = await pool.query(
    `WITH portfolio_values AS (
       SELECT user_id, SUM(value) AS total_value
       FROM assets
       WHERE asset_type = $1
         AND deleted_at IS NULL
       GROUP BY user_id
     )
     UPDATE user_alerts AS alert
     SET triggered_at = NOW(),
         triggered_value = portfolio.total_value
     FROM portfolio_values AS portfolio
     WHERE alert.user_id = portfolio.user_id
       AND alert.asset_type = $2
       AND alert.triggered_at IS NULL
       AND ((alert.condition = 'ABOVE' AND portfolio.total_value >= alert.target_price)
         OR (alert.condition = 'BELOW' AND portfolio.total_value <= alert.target_price))
     RETURNING alert.id, alert.user_id,
               alert.triggered_value::TEXT AS "triggeredValue"`,
    [dbAssetType, assetType]
  );

  return result.rows;
}

module.exports = { evaluatePortfolioAlerts };
