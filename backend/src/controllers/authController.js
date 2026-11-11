const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { validateEmail, validatePassword, validateRegistration } = require("../utils/validation");
const { AppError, accountLocked, conflict, unauthorized, validationError } = require("../utils/errors");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME = "24h";

// PRJ-SR-003: configurable lifetime, default 24h (B17). jsonwebtoken reads a
// string of digits as milliseconds, so "3600" is turned into 3600 seconds here.
function tokenLifetime() {
  const value = (process.env.JWT_EXPIRES_IN || "").trim() || DEFAULT_TOKEN_LIFETIME;
  return /^\d+$/.test(value) ? Number(value) : value;
}

// PRJ-SR-005: lockouts go to the server log. Only the user id and times: never
// the email, the password or a token. (SAD 3.9 also asks for an audit_log table,
// which does not exist yet.)
function logSecurityEvent(event, details) {
  console.warn(JSON.stringify({ event, at: new Date().toISOString(), ...details }));
}

// B3 (#56): "User@Example.com " and "user@example.com" are the same account.
// Emails are trimmed and lowercased before they are stored or looked up;
// migration 008 adds a unique index on LOWER(email) as a database backstop.
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const emailTaken = () =>
  conflict("Email is already registered.", [{ field: "email", message: "Email is already registered." }]);

// Errors are thrown and turned into the SAD error format by errorHandler
// (src/utils/errors.js); Express 5 forwards rejected async handlers to it.

exports.register = async (req, res) => {
  const { password } = req.body;
  const name = typeof req.body.name === "string" ? req.body.name.trim() : req.body.name;
  const email = normalizeEmail(req.body.email);

  // B4 (#57): email format and the SAD password policy, all field errors at once.
  const fields = validateRegistration({ name, email, password });
  if (fields.length > 0) throw validationError(fields);

  const userExists = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
  if (userExists.rows.length > 0) throw emailTaken();

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  let result;
  try {
    result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );
  } catch (error) {
    // Two registrations racing for the same email: the unique index wins.
    if (error.code === "23505") throw emailTaken();
    throw error;
  }

  res.status(201).json({ success: true, message: "User registered successfully", user: result.rows[0] });
};

exports.login = async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  const missing = [];
  if (!email) missing.push({ field: "email", message: "Email is required." });
  if (typeof password !== "string" || password === "") missing.push({ field: "password", message: "Password is required." });
  if (missing.length > 0) throw validationError(missing);

  const userResult = await pool.query("SELECT * FROM users WHERE LOWER(email) = $1", [email]);

  // Same answer for an unknown email and a wrong password (no account probing).
  if (userResult.rows.length === 0) throw unauthorized("Invalid email or password.");

  const user = userResult.rows[0];

  if (user.lock_until && new Date(user.lock_until) > new Date()) {
    const waitMinutes = Math.ceil((new Date(user.lock_until) - Date.now()) / (60 * 1000));
    logSecurityEvent("LOGIN_BLOCKED_ACCOUNT_LOCKED", { userId: user.id, lockedUntil: new Date(user.lock_until).toISOString() });
    throw accountLocked(
      `Account locked after 5 failed attempts. Please retry in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`
    );
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    // B16: an expired lock starts a new count. Without this the old count of 5 was
    // still there, so one wrong password locked the account for 15 more minutes.
    const previousAttempts = user.lock_until ? 0 : user.failed_login_attempts || 0;
    const failedAttempts = previousAttempts + 1;
    const lockUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_TIME_MS) : null;

    await pool.query(
      "UPDATE users SET failed_login_attempts = $1, lock_until = $2 WHERE id = $3",
      [failedAttempts, lockUntil, user.id]
    );

    if (lockUntil) {
      logSecurityEvent("ACCOUNT_LOCKED", { userId: user.id, lockedUntil: lockUntil.toISOString() });
    }

    throw unauthorized("Invalid email or password.");
  }

  await pool.query(
    "UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = $1",
    [user.id]
  );

  if (!process.env.JWT_SECRET) {
    // Logged in full on the server; the client only sees a generic 500.
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    // B21: jwtid (SAD 3.9) makes every token unique. Without it, logging in again
    // in the same second as a logout gave back the identical, revoked token.
    { expiresIn: tokenLifetime(), jwtid: crypto.randomUUID() }
  );

  res.status(200).json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
};

exports.logout = async (req, res) => {
  const token = req.token;
  if (token) {
    await pool.query(
      "INSERT INTO token_blacklist (token) VALUES ($1) ON CONFLICT (token) DO NOTHING",
      [token]
    );
  }
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ---------------------------------------------------------------------------
// B24: forgot / reset password (PWM-F-003, AC-PWM-F-003: the link expires after
// 30 minutes and works once; TC-Auth-03; SAD 3.9, 4.2.3, 4.4).
//
// Deviation: there is no email service yet (SAD's notification outbox does not
// exist). Outside production the reset link is written to the server console
// instead of being emailed; in production nothing secret is logged, so the
// link cannot be delivered at all until an email provider is added.
// See README.md and docs/bug-log.md (B24).
// ---------------------------------------------------------------------------

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000; // AC-PWM-F-003
const RESET_REQUESTED_MESSAGE = "If an account exists for that email, we've sent a link to reset the password.";

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const resetLinkProblem = (code, message) => new AppError(400, code, message, [{ field: "token", message }]);

function resetLink(token) {
  const origin = (process.env.FRONTEND_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");
  return `${origin}/#/reset-password?token=${encodeURIComponent(token)}`;
}

// POST /api/auth/forgot-password {email}
// Always the same 202 reply whether or not the account exists (SAD 4.3.4), so
// the answer cannot be used to find out which emails are registered.
exports.forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const problem = validateEmail(email);
  if (problem) throw validationError([{ field: "email", message: problem }]);

  // The token is made either way, so both answers take about the same work.
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);

  const found = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
  if (found.rows.length > 0) {
    const userId = found.rows[0].id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Only the newest link works: unused older links for this user are removed.
      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [userId]);
      await client.query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [userId, tokenHash, new Date(Date.now() + RESET_TOKEN_LIFETIME_MS)]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    logSecurityEvent("PASSWORD_RESET_REQUESTED", { userId });
    if (process.env.NODE_ENV !== "production") {
      // Stand-in for the email (development and tests only).
      console.info(`[password reset] Reset link for user ${userId} (valid 30 minutes): ${resetLink(token)}`);
    }
  }

  res.status(202).json({ success: true, message: RESET_REQUESTED_MESSAGE });
};

// POST /api/auth/reset-password {token, password}
// A valid, unexpired, unused token sets the new password (registration policy,
// bcrypt), is marked used, clears any lockout (PRJ-SR-005) and ends every
// existing session through users.token_valid_after (PRJ-SR-003, TC-Sec-03).
exports.resetPassword = async (req, res) => {
  const token = req.body?.token;
  const password = req.body?.password;

  if (typeof token !== "string" || token.trim() === "" || token.length > 200) {
    throw resetLinkProblem("RESET_TOKEN_INVALID", "This reset link is not valid.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, user_id, used_at, expires_at <= NOW() AS expired
       FROM password_reset_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [hashResetToken(token.trim())]
    );
    const row = found.rows[0];
    if (!row) throw resetLinkProblem("RESET_TOKEN_INVALID", "This reset link is not valid.");
    if (row.used_at) throw resetLinkProblem("RESET_TOKEN_USED", "This reset link has already been used.");
    if (row.expired) throw resetLinkProblem("RESET_TOKEN_EXPIRED", "This reset link has expired.");

    // Checked after the link, so a weak password does not use up the link.
    const problem = validatePassword(password);
    if (problem) throw validationError([{ field: "password", message: problem }]);

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    // token_valid_after is whole seconds because a JWT's iat is: a login in the
    // same second as the reset must still work (compare B21).
    await client.query(
      `UPDATE users
       SET password = $1,
           failed_login_attempts = 0,
           lock_until = NULL,
           token_valid_after = DATE_TRUNC('second', NOW()),
           updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, row.user_id]
    );
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [row.id]);
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL", [row.user_id]);
    await client.query("COMMIT");

    logSecurityEvent("PASSWORD_RESET_COMPLETED", { userId: row.user_id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  res.status(200).json({ success: true, message: "Your password has been reset. Please log in with the new password." });
};
