const express = require("express");
const jwt = require("jsonwebtoken");
const reports = require("../controllers/reportController");

const router = express.Router();
const secret =
  process.env.JWT_SECRET || "wealth_mgmt_jwt_secret_key_2026";
if (!secret) {
  throw new Error("JWT_SECRET must be set before starting the API.");
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

router.get("/export/csv", requireAuth, reports.exportCsv);
router.get("/export/pdf", requireAuth, reports.exportPdf);

module.exports = router;