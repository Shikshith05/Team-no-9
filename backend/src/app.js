const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env")
});

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 5000);

const authRoutes = require("./routes/authRoutes");
const assetRoutes = require("./routes/assetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const valuationRoutes = require("./routes/valuationRoutes");
const alertRoutes = require("./routes/alertRoutes");
const healthRoutes = require("./routes/healthRoutes");
const { startRefreshScheduler } = require("./services/refreshScheduler");
const { apiNotFound, errorHandler } = require("./utils/errors");
const { jwtSecretProblem } = require("./utils/jwtSecret");

// B18 (TC-Sec-06, SAD 3.9): security headers, and no framework fingerprint.
app.disable("x-powered-by");
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/valuations", valuationRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/health", healthRoutes);

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Unknown API routes, then the central error handler
app.use("/api", apiNotFound);
app.use(errorHandler);

if (require.main === module) {
  const secretProblem = jwtSecretProblem();
  if (secretProblem) {
    console.error(secretProblem);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);

    if (
      process.env.STOCK_PRICE_API_URL &&
      process.env.GOLD_PRICE_API_URL
    ) {
      startRefreshScheduler();
    } else {
      console.log(
        "Market refresh scheduler waiting for API configuration."
      );
    }
  });
}

module.exports = app;