
require('dotenv').config();

const express = require('express');
const app = express();

const {
  startRefreshScheduler
} = require('./services/refreshScheduler');

app.use(express.json());

// PWM-NF-003: Backend availability health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // PWM-F-020 and PWM-F-021: Automatic market price refresh
  if (
    process.env.STOCK_PRICE_API_URL &&
    process.env.GOLD_PRICE_API_URL
  ) {
    startRefreshScheduler();
  } else {
    console.log(
      'Market refresh scheduler waiting for API configuration.'
    );
  }
});

module.exports = app;
