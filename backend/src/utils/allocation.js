// Allocation rule from SAD 4.5 (PWM-F-031, TC-Dash-02): each class value divided
// by net worth, rounded to 2 decimals, with the rounding remainder added to the
// largest slice so the total is exactly 100.00. Same rule and result as
// frontend/src/lib/dashboard.js. All arithmetic is in integers (paise and basis
// points) because money must not go through floating point (SAD 3.7).

const TYPE_ORDER = ["REAL_ESTATE", "STOCK", "GOLD", "CASH"]; // ties, as in the UI

// "1234.50" -> 123450n. The SQL below always gives exactly 2 decimals.
const toPaise = (text) => BigInt(text.replace(".", ""));

function fromPaise(paise) {
  return `${paise / 100n}.${(paise % 100n).toString().padStart(2, "0")}`;
}

function typeRank(type) {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
}

// rows: [{ assetType, value: "1234.50" }], one per class.
// Returns { netWorth, allocation: [{ assetType, value, percent }] }, largest
// class first. Classes worth nothing are left out of the chart.
function buildAllocation(rows) {
  const slices = rows
    .map((row) => ({ assetType: row.assetType, paise: toPaise(row.value) }))
    .filter((slice) => slice.paise > 0n)
    .sort((a, b) => {
      if (a.paise !== b.paise) return a.paise > b.paise ? -1 : 1;
      return typeRank(a.assetType) - typeRank(b.assetType) || a.assetType.localeCompare(b.assetType);
    });

  const total = slices.reduce((sum, slice) => sum + slice.paise, 0n);
  if (total === 0n) return { netWorth: "0.00", allocation: [] };

  // 10000 basis points = 100.00%. Rounds half up.
  for (const slice of slices) {
    slice.bps = (slice.paise * 20000n + total) / (total * 2n);
  }
  // The remainder can be negative when several slices round up.
  slices[0].bps += 10000n - slices.reduce((sum, slice) => sum + slice.bps, 0n);

  return {
    netWorth: fromPaise(total),
    allocation: slices.map((slice) => ({
      assetType: slice.assetType,
      value: fromPaise(slice.paise),
      percent: fromPaise(slice.bps)
    }))
  };
}

module.exports = { buildAllocation };
