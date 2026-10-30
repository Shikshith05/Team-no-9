const pool = require("../config/db");

// Story #8: Edit Asset (PWM-F-014) - user-isolated
exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { assetName, assetType, value } = req.body;
    const userId = req.user.id;

    if (value !== undefined && (isNaN(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({ success: false, message: "Asset value cannot be negative" });
    }

    const query = `
      UPDATE assets 
      SET asset_name = COALESCE($1, asset_name),
          asset_type = COALESCE($2, asset_type),
          value = COALESCE($3, value),
          updated_at = NOW()
      WHERE id = $4 AND user_id = $5
      RETURNING *;
    `;
    const result = await pool.query(query, [assetName, assetType, value, id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Story #8: Delete Asset (PWM-F-014) - user-isolated
exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      "DELETE FROM assets WHERE id = $1 AND user_id = $2 RETURNING id;",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Asset removed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Story #22: Fast Dashboard Aggregation (PWM-NF-001) - sub-second load time
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const startTime = Date.now();

    const query = `
      SELECT 
        asset_type,
        SUM(value) AS total_value,
        COUNT(*) AS count
      FROM assets
      WHERE user_id = $1
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
