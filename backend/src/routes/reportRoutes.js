const express = require("express");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set before starting the API.");
}

const authMiddleware = require("../middleware/authMiddleware");
const reports = require("../controllers/reportController");

const router = express.Router();

router.get("/export/csv", authMiddleware, reports.exportCsv);
router.get("/export/pdf", authMiddleware, reports.exportPdf);

module.exports = router;