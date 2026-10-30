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
const { startRefreshScheduler } = require("./services/refreshScheduler");

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/reports", reportRoutes);

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) return next(err);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

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