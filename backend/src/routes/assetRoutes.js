const express = require("express");
const router = express.Router();
const assetController = require("../controllers/assetController");

router.get("/dashboard-summary", assetController.getDashboardSummary);
router.post("/", assetController.createAsset);
router.put("/:id", assetController.updateAsset);
router.delete("/:id", assetController.deleteAsset);

module.exports = router;
