const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15-minute lockout

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // Check if account is locked
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

    // Reset failed counter upon successful login
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = $1",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "wealth_mgmt_jwt_secret",
      { expiresIn: "1h" }
    );

    res.status(200).json({ success: true, token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
