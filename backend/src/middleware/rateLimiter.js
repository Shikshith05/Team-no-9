const rateLimit = require("express-rate-limit");

const tooMany = (req, res) => {
  return res.status(429).json({
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Try again in 15 minutes.",
      fields: []
    }
  });
};

const getLimit = () => Number(process.env.AUTH_RATE_LIMIT) || 10;

const baseConfig = {
  windowMs: 15 * 60 * 1000,
  limit: getLimit,
  max: getLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany
};

const authLimiter = rateLimit(baseConfig);
const loginLimiter = rateLimit({
  ...baseConfig,
  skipSuccessfulRequests: true
});

module.exports = { authLimiter, loginLimiter };

