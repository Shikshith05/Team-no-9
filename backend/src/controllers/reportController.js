
const pool = require("../config/db");
const PDFDocument = require("pdfkit");

async function getReportData(userId) {
  if (!userId) {
    throw new Error("Authenticated user ID is missing.");
  }

  // Export only active assets owned by the authenticated user.
  // Valuation history is intentionally omitted until valuations.asset_id
  // references the unified assets table safely.
  const result = await pool.query(
    `SELECT
        id,
        asset_type,
        asset_name AS name,
        value AS current_value,
        TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
        TO_CHAR(
          created_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) AS created_at
     FROM assets
     WHERE user_id = $1
       AND deleted_at IS NULL
     ORDER BY id`,
    [userId]
  );

  return result.rows;
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
    const assets = await getReportData(req.user.id);

    const header = [
      "record_type",
      "asset_type",
      "asset_id",
      "name",
      "current_value",
      "purchase_date",
      "created_at"
    ];

    const rows = assets.map(asset => [
      "ASSET",
      asset.asset_type,
      asset.id,
      asset.name,
      asset.current_value,
      asset.purchase_date,
      asset.created_at
    ]);

    const csv = [header, ...rows]
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
    const assets = await getReportData(req.user.id);

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
        `${asset.asset_type} | ID: ${asset.id} | ${asset.name || ""}`
      );
      doc.text(`Current value: INR ${asset.current_value}`);
      doc.text(`Purchase date: ${asset.purchase_date}`);
      doc.text(`Created at: ${asset.created_at}`);
      doc.moveDown(0.4);
    }

    doc.moveDown();
    doc.fontSize(9).text(
      "Valuation history is temporarily omitted pending correction " +
      "of the asset ownership relationship."
    );

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
