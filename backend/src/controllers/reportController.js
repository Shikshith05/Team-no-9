const pool = require("../config/db");
const PDFDocument = require("pdfkit");

async function getReportData() {
  const [realEstate, gold, stocks, cash, valuations] = await Promise.all([
    pool.query(`
      SELECT id, property_name AS name, location AS details,
             purchase_value, current_estimated_value AS current_value,
             purchase_date, created_at
      FROM real_estate_assets ORDER BY id
    `),
    pool.query(`
      SELECT id, asset_name AS name,
             gold_type || ' / ' || purity AS details,
             purchase_value, current_estimated_value AS current_value,
             purchase_date, weight_grams AS quantity, created_at
      FROM gold_assets ORDER BY id
    `),
    pool.query(`
      SELECT id, ticker_symbol AS name, quantity,
             average_buy_price AS unit_price, created_at
      FROM stock_assets ORDER BY id
    `),
    pool.query(`
      SELECT id, account_label AS name,
             current_balance AS current_value, created_at
      FROM cash_bank_assets ORDER BY id
    `),
    pool.query(`
      SELECT asset_type, asset_id, value, unit_price, source, valued_at
      FROM valuations ORDER BY valued_at DESC
    `)
  ]);

  return {
    assets: [
      ...realEstate.rows.map(r => ({
        type: "REAL_ESTATE", ...r
      })),
      ...gold.rows.map(r => ({
        type: "GOLD", ...r
      })),
      ...stocks.rows.map(r => ({
        type: "STOCK", ...r
      })),
      ...cash.rows.map(r => ({
        type: "CASH_BANK", ...r
      }))
    ],
    valuations: valuations.rows
  };
}

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return /[",\r\n]/.test(safe)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

exports.exportCsv = async (req, res) => {
  try {
    const { assets, valuations } = await getReportData();
    const header = [
      "record_type", "asset_type", "asset_id", "name", "details",
      "purchase_value", "purchase_date", "quantity", "unit_price",
      "current_value", "valuation_value", "source", "valued_at"
    ];

    const assetRows = assets.map(a => [
      "ASSET", a.type, a.id, a.name, a.details,
      a.purchase_value, a.purchase_date, a.quantity, a.unit_price,
      a.current_value, "", "", ""
    ]);

    const valuationRows = valuations.map(v => [
      "VALUATION", v.asset_type, v.asset_id, "", "", "", "", "",
      v.unit_price, "", v.value, v.source, v.valued_at
    ]);

    const csv = [header, ...assetRows, ...valuationRows]
      .map(row => row.map(csvCell).join(","))
      .join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="personal-wealth-report.csv"'
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send("\uFEFF" + csv);
  } catch (error) {
    console.error("CSV export failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to generate CSV report."
    });
  }
};

exports.exportPdf = async (req, res) => {
  try {
    const { assets, valuations } = await getReportData();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="personal-wealth-report.pdf"'
    );
    res.setHeader("Cache-Control", "no-store");

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(20).text("Personal Wealth Management Report");
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();

    doc.fontSize(15).text(`Current Assets (${assets.length})`);
    doc.moveDown(0.5);
    doc.fontSize(9);

    for (const asset of assets) {
      doc.text(
        `${asset.type} | ID: ${asset.id} | ${asset.name || ""}`
      );
      if (asset.details) doc.text(`Details: ${asset.details}`);
      if (asset.current_value != null) {
        doc.text(`Current value: INR ${asset.current_value}`);
      }
      if (asset.quantity != null) {
        doc.text(`Quantity/weight: ${asset.quantity}`);
      }
      doc.moveDown(0.4);
    }

    doc.addPage();
    doc.fontSize(15).text(`Valuation History (${valuations.length})`);
    doc.moveDown(0.5);
    doc.fontSize(9);

    for (const v of valuations) {
      doc.text(
        `${v.asset_type} | Asset ID: ${v.asset_id} | ` +
        `Value: INR ${v.value} | Source: ${v.source} | ` +
        `Date: ${new Date(v.valued_at).toISOString()}`,
        { width: 510 }
      );
      doc.moveDown(0.4);
    }

    doc.end();
  } catch (error) {
    console.error("PDF export failed:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate PDF report."
      });
    }
    res.destroy(error);
  }
};