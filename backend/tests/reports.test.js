// CSV / PDF export regression tests (PWM-F-033):
// Authentication, ownership isolation and date formatting.

import zlib from "zlib";
import { beforeEach, describe, expect, it } from "vitest";

import {
  app,
  pool,
  request,
  resetDatabase,
  createLoggedInUser,
  createAsset
} from "./helpers";

// Text drawn in a PDFKit document: inflate each content stream, then decode
// the hex strings PDFKit writes for the standard fonts ("<4d79...> Tj").
function pdfText(buffer) {
  const raw = buffer.toString("latin1");
  let text = "";

  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;

    try {
      content = zlib
        .inflateSync(Buffer.from(match[1], "latin1"))
        .toString("latin1");
    } catch {
      continue;
    }

    for (const line of content.split("\n")) {
      const hex = [...line.matchAll(/<([0-9a-fA-F]+)>/g)]
        .map((m) => Buffer.from(m[1], "hex").toString("latin1"));

      if (hex.length > 0) {
        text += hex.join("") + "\n";
      }
    }
  }

  return text;
}

beforeEach(resetDatabase);

// Collect a binary response body as a Buffer.
function binary(res, callback) {
  const chunks = [];

  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("report exports", () => {
  // ---------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------

  it("require authentication", async () => {
    expect(
      (await request(app).get("/api/reports/export/csv")).status
    ).toBe(401);

    expect(
      (await request(app).get("/api/reports/export/pdf")).status
    ).toBe(401);
  });

  // ---------------------------------------------------------
  // Existing CSV asset export test
  // ---------------------------------------------------------

  it("CSV contains only the caller's active assets", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");

    await createAsset(me.auth, {
      assetName: "My Flat",
      value: 100
    });

    const deleted = await createAsset(me.auth, {
      assetName: "Sold Car",
      value: 5
    });

    await createAsset(other.auth, {
      assetName: "Their Villa",
      value: 900
    });

    await request(app)
      .delete(`/api/assets/${deleted.id}`)
      .set("Authorization", me.auth);

    const res = await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", me.auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);

    expect(res.text).toContain("My Flat");
    expect(res.text).not.toContain("Sold Car");
    expect(res.text).not.toContain("Their Villa");

    expect(res.text.trim().split("\r\n")).toHaveLength(2);
  });

  // ---------------------------------------------------------
  // Existing PDF asset export test
  // ---------------------------------------------------------

  it("PDF contains only the caller's active assets", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");

    await createAsset(me.auth, {
      assetName: "My Flat"
    });

    const deleted = await createAsset(me.auth, {
      assetName: "Sold Car"
    });

    await createAsset(other.auth, {
      assetName: "Their Villa"
    });

    await request(app)
      .delete(`/api/assets/${deleted.id}`)
      .set("Authorization", me.auth);

    const res = await request(app)
      .get("/api/reports/export/pdf")
      .set("Authorization", me.auth)
      .buffer(true)
      .parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");

    const text = pdfText(res.body);

    expect(text).toContain("Current Assets (1)");
    expect(text).toContain("My Flat");

    expect(text).not.toContain("Sold Car");
    expect(text).not.toContain("Their Villa");
  });

  // ---------------------------------------------------------
  // B13: CSV date and timezone formatting
  // ---------------------------------------------------------

  it("CSV preserves purchase dates and formats created_at in UTC", async () => {
    const { auth } = await createLoggedInUser("date-csv@example.com");

    const asset = await createAsset(auth, {
      assetName: "Date Boundary Flat",
      assetType: "REAL_ESTATE",
      value: 123,
      purchaseDate: "2021-03-15"
    });

    // This timestamp is January 1 in IST but December 31 in UTC.
    await pool.query(
      "UPDATE assets SET created_at = $1::timestamptz WHERE id = $2",
      ["2026-01-01T00:15:00+05:30", asset.id]
    );

    const res = await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);

    // Purchase date must remain a date-only value.
    expect(res.text).toContain("2021-03-15");

    // Creation timestamp must be formatted in UTC.
    expect(res.text).toContain("2025-12-31T18:45:00.000Z");

    // Local timestamp must not appear in the export.
    expect(res.text).not.toContain("2026-01-01T00:15:00");
  });

  // ---------------------------------------------------------
  // B13: PDF date and timezone formatting
  // ---------------------------------------------------------

  it("PDF preserves purchase dates and formats created_at in UTC", async () => {
    const { auth } = await createLoggedInUser("date-pdf@example.com");

    const asset = await createAsset(auth, {
      assetName: "PDF Date Boundary Flat",
      assetType: "REAL_ESTATE",
      value: 456,
      purchaseDate: "2021-03-15"
    });

    // Use the same timezone boundary to detect accidental conversion.
    await pool.query(
      "UPDATE assets SET created_at = $1::timestamptz WHERE id = $2",
      ["2026-01-01T00:15:00+05:30", asset.id]
    );

    const res = await request(app)
      .get("/api/reports/export/pdf")
      .set("Authorization", auth)
      .buffer(true)
      .parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");

    const text = pdfText(res.body);

    // Purchase date must remain YYYY-MM-DD.
    expect(text).toContain("Purchase date: 2021-03-15");

    // Created timestamp must be ISO 8601 UTC.
    expect(text).toContain(
      "Created at: 2025-12-31T18:45:00.000Z"
    );

    expect(text).not.toContain("2026-01-01T00:15:00");
  });
});
