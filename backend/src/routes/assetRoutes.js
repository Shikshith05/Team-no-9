const express = require("express");
const router = express.Router();
const assetController = require("../controllers/assetController");

// Story #22: Fast dashboard load endpoint
router.get("/dashboard-summary", assetController.getDashboardSummary);

// Story #8: Edit and delete asset endpoints
router.put("/:id", assetController.updateAsset);
router.delete("/:id", assetController.deleteAsset);

module.exports = router;
