const express = require("express");
const pool = require("../config/db");
const { errorBody } = require("../utils/errors");

const router = express.Router();

// SAD 4.3.2 (PWM-NF-003): liveness and database readiness, public, with no details.
// The backend container's health check uses this.
router.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json(errorBody("SERVICE_UNAVAILABLE", "Service unavailable."));
  }
});

module.exports = router;
