// CSV / PDF export regression tests (PWM-F-033): auth required, caller's assets only.
import zlib from "zlib";
import { beforeEach, describe, expect, it } from "vitest";
import { app, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";

// Text drawn in a PDFKit document: inflate each content stream, then decode
// the hex strings PDFKit writes for the standard fonts ("<4d79...> Tj").
function pdfText(buffer) {
  const raw = buffer.toString("latin1");
  let text = "";
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;
    try {
      content = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue; // not a deflated stream (e.g. font data)
    }
    for (const line of content.split("\n")) {
      const hex = [...line.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
      if (hex.length > 0) text += hex.join("") + "\n";
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
  it("require authentication", async () => {
    expect((await request(app).get("/api/reports/export/csv")).status).toBe(401);
    expect((await request(app).get("/api/reports/export/pdf")).status).toBe(401);
  });

  it("CSV contains only the caller's active assets", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");
    await createAsset(me.auth, { assetName: "My Flat", value: 100 });
    const deleted = await createAsset(me.auth, { assetName: "Sold Car", value: 5 });
    await createAsset(other.auth, { assetName: "Their Villa", value: 900 });
    await request(app).delete(`/api/assets/${deleted.id}`).set("Authorization", me.auth);

    const res = await request(app).get("/api/reports/export/csv").set("Authorization", me.auth);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("My Flat");
    expect(res.text).not.toContain("Sold Car");
    expect(res.text).not.toContain("Their Villa");
    expect(res.text.trim().split("\r\n")).toHaveLength(2); // header + one asset
  });

  it("PDF contains only the caller's active assets", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");
    await createAsset(me.auth, { assetName: "My Flat" });
    const deleted = await createAsset(me.auth, { assetName: "Sold Car" });
    await createAsset(other.auth, { assetName: "Their Villa" });
    await request(app).delete(`/api/assets/${deleted.id}`).set("Authorization", me.auth);

    const res = await request(app).get("/api/reports/export/pdf").set("Authorization", me.auth).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");

    const text = pdfText(res.body);
    expect(text).toContain("Current Assets (1)");
    expect(text).toContain("My Flat");
    expect(text).not.toContain("Sold Car");
    expect(text).not.toContain("Their Villa");
  });
});
