const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env")
});

const app = express();
const PORT = Number(process.env.PORT || 5000);

const authRoutes = require("./routes/authRoutes");
const assetRoutes = require("./routes/assetRoutes");
const reportRoutes = require("./routes/reportRoutes");
const valuationRoutes = require("./routes/valuationRoutes");
const { startRefreshScheduler } = require("./services/refreshScheduler");
const { apiNotFound, errorHandler } = require("./utils/errors");

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/valuations", valuationRoutes);
// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Unknown API routes, then the central error handler: every error leaves
// the API in the SAD format {"error":{"code","message","fields"}} (B6, #55).
app.use("/api", apiNotFound);
app.use(errorHandler);

if (require.main === module) {
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