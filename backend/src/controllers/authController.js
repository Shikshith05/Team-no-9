const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15-minute lockout

// Registration
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login with 5-attempt Lockout (#31)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // Check account lockout status
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.lock_until) - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account locked due to 5 consecutive failed attempts. Try again in ${waitMinutes} minutes.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      }

      await pool.query(
        "UPDATE users SET failed_login_attempts = $1, lock_until = $2 WHERE id = $3",
        [failedAttempts, lockUntil, user.id]
      );

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts)
      });
    }

    // Reset attempts on successful authentication
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = $1",
      [user.id]
    );

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "Server misconfiguration: JWT_SECRET environment variable is missing" });
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
