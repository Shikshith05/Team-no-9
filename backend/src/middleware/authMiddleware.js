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
    // B24 (SAD 3.9, PRJ-SR-003, TC-Sec-03): a password reset sets
    // users.token_valid_after, and tokens issued before it are rejected.
    const check = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM token_blacklist WHERE token = $1) AS revoked,
              (SELECT FLOOR(EXTRACT(EPOCH FROM token_valid_after))::BIGINT FROM users WHERE id = $2) AS valid_after`,
      [token, Number.isInteger(decoded.id) ? decoded.id : null]
    );
    const { revoked, valid_after: validAfter } = check.rows[0];
    if (revoked) {
      return next(unauthorized("Token has been revoked. Please log in again."));
    }
    if (validAfter !== null && (typeof decoded.iat !== "number" || decoded.iat < Number(validAfter))) {
      return next(unauthorized("Your password was changed. Please log in again."));
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded; // { id, email }
  req.token = token;
  next();
};

module.exports = authMiddleware;
