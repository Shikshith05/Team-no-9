const pool = require("../config/db");
const { validationError } = require("../utils/errors");

const MAX_VALUE = 9999999999999.99;

exports.listAlerts = async (req, res) => {
  const result = await pool.query(
    `SELECT id, asset_type AS "assetType",
            condition, target_price AS "targetPrice",
            created_at AS "createdAt"
     FROM user_alerts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  res.status(200).json({ success: true, data: result.rows });
};

exports.createAlert = async (req, res) => {
  const { assetType, condition, targetPrice } = req.body;
  const fields = [];

  if (!["stock", "gold"].includes(assetType)) {
    fields.push({ field: "assetType", message: "Asset type must be stock or gold." });
  }

  if (!["ABOVE", "BELOW"].includes(condition)) {
    fields.push({ field: "condition", message: "Condition must be ABOVE or BELOW." });
  }

  const validPrice =
    targetPrice !== undefined &&
    targetPrice !== null &&
    targetPrice !== "" &&
    typeof targetPrice !== "boolean" &&
    Number.isFinite(Number(targetPrice)) &&
    Number(targetPrice) > 0 &&
    Number(targetPrice) <= MAX_VALUE &&
    /^\d+(\.\d{1,2})?$/.test(String(targetPrice).trim());

  if (!validPrice) {
    fields.push({ field: "targetPrice", message: "Target price must be a positive amount with at most 2 decimal places." });
  }

  if (fields.length > 0) throw validationError(fields);

  const result = await pool.query(
    `INSERT INTO user_alerts (user_id, asset_type, condition, target_price)
     VALUES ($1, $2, $3, $4)
     RETURNING id, asset_type AS "assetType",
               condition, target_price AS "targetPrice",
               created_at AS "createdAt"`,
    [req.user.id, assetType, condition, Number(targetPrice)]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
};
