const express = require("express");
const router = express.Router();
const assetController = require("../controllers/assetController");
const authMiddleware = require("../middleware/authMiddleware");

// Enforce auth on ALL asset routes
router.use(authMiddleware);

// /dashboard-summary must stay above /:id so it is not read as an asset id.
router.get("/dashboard-summary", assetController.getDashboardSummary);
router.get("/", assetController.listAssets);
router.get("/:id", assetController.getAsset);
router.post("/", assetController.createAsset);
router.put("/:id/valuation", assetController.updateValuation);
router.put("/:id", assetController.updateAsset);
router.delete("/:id", assetController.deleteAsset);

module.exports = router;
