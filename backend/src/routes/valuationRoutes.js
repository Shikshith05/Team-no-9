const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const valuationController = require("../controllers/valuationController");

// All valuation-history routes require authentication.
router.use(authMiddleware);

router.get("/history", valuationController.getHistory);

module.exports = router;