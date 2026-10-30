const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "Server misconfiguration: JWT_SECRET missing" });
    }

    // Verify token is not in PostgreSQL blacklist
    const blacklistCheck = await pool.query(
      "SELECT id FROM token_blacklist WHERE token = $1",
      [token]
    );

    if (blacklistCheck.rows.length > 0) {
      return res.status(401).json({ success: false, message: "Token has been revoked. Please log in again." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
