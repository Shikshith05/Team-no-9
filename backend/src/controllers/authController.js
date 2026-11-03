const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateRegistration } = require("../utils/validation");
const { accountLocked, conflict, unauthorized, validationError } = require("../utils/errors");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

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
    throw accountLocked(`Account locked after 5 failed attempts. Please retry in ${waitMinutes} minutes.`);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    const lockUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_TIME_MS) : null;

    await pool.query(
      "UPDATE users SET failed_login_attempts = $1, lock_until = $2 WHERE id = $3",
      [failedAttempts, lockUntil, user.id]
    );

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
    { expiresIn: "1h" }
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
