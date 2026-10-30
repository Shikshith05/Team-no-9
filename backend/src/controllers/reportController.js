const pool = require("../config/db");
const PDFDocument = require("pdfkit");

async function getReportData(userId) {
  if (!userId) {
    throw new Error("Authenticated user ID is missing.");
  }

  const [assets, valuations] = await Promise.all([
    pool.query(
      `SELECT
          id,
          asset_type,
          asset_name AS name,
          value AS current_value,
          purchase_date,
          created_at
       FROM assets
       WHERE user_id = $1
         AND deleted_at IS NULL
       ORDER BY id`,
      [userId]
    ),

    pool.query(
      `SELECT
          v.asset_type,
          v.asset_id,
          v.value,
          v.unit_price,
          v.source,
          v.valued_at
       FROM valuations v
       INNER JOIN assets a ON a.id = v.asset_id
       WHERE a.user_id = $1
         AND a.deleted_at IS NULL
       ORDER BY v.valued_at DESC`,
      [userId]
    )
  ]);

  return {
    assets: assets.rows,
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
    const { assets, valuations } = await getReportData(req.user.id);

    const header = [
      "record_type",
      "asset_type",
      "asset_id",
      "name",
      "current_value",
      "purchase_date",
      "created_at",
      "valuation_value",
      "unit_price",
      "source",
      "valued_at"
    ];

    const assetRows = assets.map(a => [
      "ASSET",
      a.asset_type,
      a.id,
      a.name,
      a.current_value,
      a.purchase_date,
      a.created_at,
      "",
      "",
      "",
      ""
    ]);

    const valuationRows = valuations.map(v => [
      "VALUATION",
      v.asset_type,
      v.asset_id,
      "",
      "",
      "",
      "",
      v.value,
      v.unit_price,
      v.source,
      v.valued_at
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
    const { assets, valuations } = await getReportData(req.user.id);

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
        `${asset.asset_type} | ID: ${asset.id} | ${asset.name}`
      );
      doc.text(`Current value: INR ${asset.current_value}`);
      if (asset.purchase_date) {
        doc.text(`Purchase date: ${asset.purchase_date}`);
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