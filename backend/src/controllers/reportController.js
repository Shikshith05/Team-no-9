const pool = require("../config/db");
const PDFDocument = require("pdfkit");
const { errorBody } = require("../utils/errors");

async function getReportData(userId) {
  if (!userId) {
    throw new Error("Authenticated user ID is missing.");
  }

  // Export only active assets owned by the authenticated user.
  const assetResult = await pool.query(
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

  // Export only valuations whose unified asset belongs to this user.
  // Legacy rows have asset_id = NULL and are intentionally excluded.
  // The join also excludes valuations attached to soft-deleted assets.
  const valuationResult = await pool.query(
    `SELECT
        v.id,
        v.asset_id,
        a.asset_type,
        a.asset_name AS asset_name,
        v.value AS valuation_value,
        v.unit_price,
        v.source,
        TO_CHAR(
          v.valued_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) AS valued_at
     FROM valuations v
     INNER JOIN assets a ON a.id = v.asset_id
     WHERE a.user_id = $1
       AND a.deleted_at IS NULL
       AND v.asset_id IS NOT NULL
     ORDER BY v.valued_at DESC, v.id DESC`,
    [userId]
  );

  return {
    assets: assetResult.rows,
    valuations: valuationResult.rows
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

    // Existing asset columns are preserved. Valuation-specific columns
    // are appended so existing CSV consumers can still identify ASSET rows.
    const header = [
      "record_type",
      "asset_type",
      "asset_id",
      "name",
      "current_value",
      "purchase_date",
      "created_at",
      "valuation_id",
      "valuation_value",
      "unit_price",
      "valuation_source",
      "valued_at"
    ];

    const assetRows = assets.map((asset) => [
      "ASSET",
      asset.asset_type,
      asset.id,
      asset.name,
      asset.current_value,
      asset.purchase_date,
      asset.created_at,
      "",
      "",
      "",
      "",
      ""
    ]);

    const valuationRows = valuations.map((valuation) => [
      "VALUATION",
      valuation.asset_type,
      valuation.asset_id,
      valuation.asset_name,
      "",
      "",
      "",
      valuation.id,
      valuation.valuation_value,
      valuation.unit_price,
      valuation.source,
      valuation.valued_at
    ]);

    const csv = [header, ...assetRows, ...valuationRows]
      .map((row) => row.map(csvCell).join(","))
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

    return res.status(500).json(
      errorBody("INTERNAL_ERROR", "Unable to generate CSV report.")
    );
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
        `${asset.asset_type} | ID: ${asset.id} | ${asset.name || ""}`
      );
      doc.text(`Current value: INR ${asset.current_value}`);
      doc.text(`Purchase date: ${asset.purchase_date}`);
      doc.text(`Created at: ${asset.created_at}`);
      doc.moveDown(0.4);
    }

    doc.moveDown();
    doc.fontSize(15).text(`Valuation History (${valuations.length})`);
    doc.moveDown(0.5);
    doc.fontSize(9);

    if (valuations.length === 0) {
      doc.text("No valuation history available.");
    } else {
      for (const valuation of valuations) {
        doc.text(
          `${valuation.asset_type} | Asset ID: ${valuation.asset_id} | ` +
          `${valuation.asset_name || ""}`
        );
        doc.text(
          `Valuation ID: ${valuation.id} | ` +
          `Value: INR ${valuation.valuation_value}`
        );
        doc.text(
          `Source: ${valuation.source} | Valued at: ${valuation.valued_at}`
        );

        if (valuation.unit_price != null) {
          doc.text(`Unit price: INR ${valuation.unit_price}`);
        }

        doc.moveDown(0.4);
      }
    }

    doc.end();
  } catch (error) {
    console.error("PDF export failed:", error.message);

    if (!res.headersSent) {
      return res.status(500).json(
        errorBody("INTERNAL_ERROR", "Unable to generate PDF report.")
      );
    }

    res.destroy(error);
  }
};