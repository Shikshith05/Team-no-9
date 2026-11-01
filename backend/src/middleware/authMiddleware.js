const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { unauthorized } = require("../utils/errors");

// Requires "Authorization: Bearer <token>". Problems with the token are
// 401 UNAUTHORIZED; a database or configuration failure is passed on to
// errorHandler, which answers 500 without details (B6, #55).
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(unauthorized("Authorization token required."));
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is not configured"));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(unauthorized("Invalid or expired token. Please log in again."));
  }

  try {
    // Logged-out tokens are kept in the PostgreSQL blacklist until they expire.
    const blacklistCheck = await pool.query("SELECT id FROM token_blacklist WHERE token = $1", [token]);
    if (blacklistCheck.rows.length > 0) {
      return next(unauthorized("Token has been revoked. Please log in again."));
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded; // { id, email }
  req.token = token;
  next();
};

module.exports = authMiddleware;
