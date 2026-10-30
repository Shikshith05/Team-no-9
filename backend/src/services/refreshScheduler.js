
const {
  refreshAllMarketPrices
} = require("./marketRefresh");

const REFRESH_INTERVAL_MS = Number(
  process.env.VALUATION_REFRESH_INTERVAL_MS || 60000
);

let refreshTimer = null;
let isRefreshing = false;

async function runScheduledRefresh() {
  if (isRefreshing) {
    console.log("Previous market refresh is still running. Skipping this cycle.");
    return;
  }

  isRefreshing = true;

  try {
    console.log("Starting automatic stock and gold price refresh...");

    const results = await refreshAllMarketPrices();

    for (const [assetType, result] of Object.entries(results)) {
      if (result.status === "fulfilled") {
        console.log(`${assetType} refresh completed:`, result.value);
      } else {
        console.error(`${assetType} refresh failed:`, result.reason.message);
      }
    }
  } catch (error) {
    console.error("Market refresh scheduler error:", error.message);
  } finally {
    isRefreshing = false;
  }
}

function startRefreshScheduler() {
  if (refreshTimer) {
    console.log("Market refresh scheduler is already running.");
    return;
  }

  if (
    !Number.isFinite(REFRESH_INTERVAL_MS) ||
    REFRESH_INTERVAL_MS < 1000
  ) {
    throw new Error("Invalid market refresh interval");
  }

  // Run once immediately when the scheduler starts.
  runScheduledRefresh();

  // Repeat at the configured interval.
  refreshTimer = setInterval(
    runScheduledRefresh,
    REFRESH_INTERVAL_MS
  );

  console.log(
    `Market refresh scheduler started. Interval: ${REFRESH_INTERVAL_MS} ms`
  );
}

function stopRefreshScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log("Market refresh scheduler stopped.");
  }
}

module.exports = {
  startRefreshScheduler,
  stopRefreshScheduler,
  runScheduledRefresh
};
