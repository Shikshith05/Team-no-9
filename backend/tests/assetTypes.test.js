// B22: per-type asset fields and validation.
// PWM-F-010 (TC-RE-01), PWM-F-011 (TC-Gold-01), PWM-F-012 (TC-Stock-01),
// PWM-F-013 (TC-Cash-01), PWM-F-014 (TC-Asset-01), PWM-F-015 (TC-Asset-02),
// PRJ-SR-004 (ownership). Contracts follow SAD 4.3.3 and 4.4.
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";

beforeEach(resetDatabase);

// The SAD 4.3.3 example bodies (plus `value`, the user's starting value).
const VALID = {
  REAL_ESTATE: {
    assetType: "REAL_ESTATE",
    assetName: "Flat, Adyar",
    location: "Chennai",
    purchaseValue: "6500000.00",
    purchaseDate: "2021-03-15",
    value: "8200000.00"
  },
  GOLD: { assetType: "GOLD", form: "COIN", purityKarat: 22, weightGrams: "20.000", purchasePrice: "110000.00", value: "120000.00" },
  STOCK: { assetType: "STOCK", ticker: "RELIANCE", exchange: "NSE", quantity: "10", averageBuyPrice: "2800.00", value: "28500.00" },
  CASH: { assetType: "CASH", accountLabel: "Savings account", value: "150000.00" }
};

const post = (auth, body) => request(app).post("/api/assets").set("Authorization", auth).send(body);
const put = (auth, id, body) => request(app).put(`/api/assets/${id}`).set("Authorization", auth).send(body);
const getOne = (auth, id) => request(app).get(`/api/assets/${id}`).set("Authorization", auth);

function expectFieldErrors(res, expected) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.error.fields).toEqual(expected);
}

describe("POST /api/assets: a valid asset of each type (TC-RE-01, TC-Gold-01, TC-Stock-01, TC-Cash-01)", () => {
  it("real estate keeps name, location, purchase value and date, and the estimated value", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, VALID.REAL_ESTATE);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ asset_type: "REAL_ESTATE", asset_name: "Flat, Adyar", value: "8200000.00" });

    const { body } = await getOne(auth, res.body.data.id);
    expect(body).toMatchObject({
      assetType: "REAL_ESTATE",
      name: "Flat, Adyar",
      location: "Chennai",
      purchaseValue: "6500000.00",
      purchaseDate: "2021-03-15",
      currentValue: "8200000.00",
      form: null,
      ticker: null,
      accountLabel: null
    });
  });

  it("gold keeps form, purity, weight and purchase price; the name defaults from them", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.GOLD, form: "coin", purityKarat: "22K" });
    expect(res.status).toBe(201);

    const { body } = await getOne(auth, res.body.data.id);
    expect(body).toMatchObject({
      assetType: "GOLD",
      name: "Gold coin (22K)",
      form: "COIN",
      purityKarat: 22,
      weightGrams: "20.000",
      purchasePrice: "110000.00",
      currentValue: "120000.00",
      location: null,
      purchaseValue: null
    });
  });

  it("each gold form is accepted (jewellery, coin, bar)", async () => {
    const { auth } = await createLoggedInUser();
    for (const form of ["JEWELLERY", "COIN", "BAR"]) {
      expect((await post(auth, { ...VALID.GOLD, form })).status).toBe(201);
    }
    expect((await post(auth, { ...VALID.GOLD, purityKarat: 1 })).status).toBe(201);
    expect((await post(auth, { ...VALID.GOLD, purityKarat: 24 })).status).toBe(201);
  });

  it("stock keeps ticker (upper case), exchange, quantity and average buy price", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.STOCK, ticker: " m&m ", exchange: undefined, quantity: "2.5" });
    expect(res.status).toBe(201);

    const { body } = await getOne(auth, res.body.data.id);
    expect(body).toMatchObject({
      assetType: "STOCK",
      name: "M&M",
      ticker: "M&M",
      exchange: "NSE",
      quantity: "2.5",
      averageBuyPrice: "2800.00",
      currentValue: "28500.00"
    });
  });

  it("cash keeps the account label and balance", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.CASH, assetName: "HDFC savings" });
    expect(res.status).toBe(201);

    const { body } = await getOne(auth, res.body.data.id);
    expect(body).toMatchObject({ assetType: "CASH", name: "HDFC savings", accountLabel: "Savings account", currentValue: "150000.00" });
  });

  it("decimal fields accept JSON numbers as well as decimal strings", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.STOCK, quantity: 10, averageBuyPrice: 2800.5, value: 28505 });
    expect(res.status).toBe(201);
    const { body } = await getOne(auth, res.body.data.id);
    expect(body).toMatchObject({ quantity: "10", averageBuyPrice: "2800.50", currentValue: "28505.00" });
  });

  it("fields of another type are ignored, not stored", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.CASH, ticker: "INFY", location: "Pune", purityKarat: 22 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ticker: null, location: null, purity_karat: null });
  });
});

describe("POST /api/assets: asset type", () => {
  it("an unknown type is rejected (it used to be stored as free text)", async () => {
    const { auth } = await createLoggedInUser();
    for (const assetType of ["banana", "cash_bank", "CRYPTO", 7]) {
      const res = await post(auth, { assetType, assetName: "x", value: "1.00" });
      expectFieldErrors(res, [{ field: "assetType", message: "Asset type must be one of REAL_ESTATE, GOLD, STOCK, CASH." }]);
    }
    expect((await pool.query("SELECT COUNT(*)::INT AS n FROM assets")).rows[0].n).toBe(0);
  });

  it("a missing type is rejected", async () => {
    const { auth } = await createLoggedInUser();
    expectFieldErrors(await post(auth, { value: "1.00" }), [{ field: "assetType", message: "Asset type is required." }]);
  });

  it("the type is case-insensitive and stored under its SAD name", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, { ...VALID.CASH, assetType: " cash " });
    expect(res.status).toBe(201);
    expect(res.body.data.asset_type).toBe("CASH");
  });
});

describe("POST /api/assets: missing and invalid fields per type (TC-Asset-02)", () => {
  it("real estate: every SRS field is required", async () => {
    const { auth } = await createLoggedInUser();
    expectFieldErrors(await post(auth, { assetType: "REAL_ESTATE" }), [
      { field: "assetName", message: "Asset name is required." },
      { field: "location", message: "Location is required." },
      { field: "purchaseValue", message: "Purchase value is required." },
      { field: "value", message: "Value is required." },
      { field: "purchaseDate", message: "Purchase date is required." }
    ]);
  });

  it("real estate: lengths, negative money and a bad date", async () => {
    const { auth } = await createLoggedInUser();
    const res = await post(auth, {
      ...VALID.REAL_ESTATE,
      assetName: "n".repeat(256),
      location: "l".repeat(256),
      purchaseValue: "-1",
      value: "1.234",
      purchaseDate: "2021-02-30"
    });
    expectFieldErrors(res, [
      { field: "assetName", message: "Asset name must be at most 255 characters." },
      { field: "location", message: "Location must be at most 255 characters." },
      { field: "purchaseValue", message: "Purchase value cannot be negative." },
      { field: "value", message: "Value can have at most 2 decimal places." },
      { field: "purchaseDate", message: "Purchase date must be a valid date (YYYY-MM-DD)." }
    ]);
  });

  it("gold: every SRS field is required", async () => {
    const { auth } = await createLoggedInUser();
    expectFieldErrors(await post(auth, { assetType: "GOLD" }), [
      { field: "form", message: "Form is required." },
      { field: "purityKarat", message: "Purity is required." },
      { field: "weightGrams", message: "Weight is required." },
      { field: "purchasePrice", message: "Purchase price is required." },
      { field: "value", message: "Value is required." }
    ]);
  });

  it("gold: purity 0 and 25, a negative weight and an unknown form are rejected (TC-Gold-01)", async () => {
    const { auth } = await createLoggedInUser();
    const purity = "Purity must be a whole number of karats from 1 to 24.";
    for (const purityKarat of [0, 25, "22.5", "abc"]) {
      expectFieldErrors(await post(auth, { ...VALID.GOLD, purityKarat }), [{ field: "purityKarat", message: purity }]);
    }
    expectFieldErrors(await post(auth, { ...VALID.GOLD, weightGrams: "-5" }), [
      { field: "weightGrams", message: "Weight cannot be negative." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.GOLD, weightGrams: "0" }), [
      { field: "weightGrams", message: "Weight must be more than 0." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.GOLD, weightGrams: "1.0005" }), [
      { field: "weightGrams", message: "Weight can have at most 3 decimal places." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.GOLD, form: "BISCUIT" }), [
      { field: "form", message: "Form must be one of JEWELLERY, COIN, BAR." }
    ]);
  });

  it("stock: every SRS field is required", async () => {
    const { auth } = await createLoggedInUser();
    expectFieldErrors(await post(auth, { assetType: "STOCK" }), [
      { field: "ticker", message: "Ticker is required." },
      { field: "quantity", message: "Quantity is required." },
      { field: "averageBuyPrice", message: "Average buy price is required." },
      { field: "value", message: "Value is required." }
    ]);
  });

  it("stock: ticker format, exchange, quantity and price are checked", async () => {
    const { auth } = await createLoggedInUser();
    const ticker = 'Ticker must be 1 to 20 letters or digits (also "&", "-" or "."), like RELIANCE.';
    for (const bad of ["RELI ANCE", "-INFY", "A".repeat(21), "<script>", 42]) {
      expectFieldErrors(await post(auth, { ...VALID.STOCK, ticker: bad }), [{ field: "ticker", message: ticker }]);
    }
    expectFieldErrors(await post(auth, { ...VALID.STOCK, exchange: "NYSE" }), [
      { field: "exchange", message: "Exchange must be one of NSE, BSE." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.STOCK, quantity: "0", averageBuyPrice: true }), [
      { field: "quantity", message: "Quantity must be more than 0." },
      { field: "averageBuyPrice", message: "Average buy price must be a number." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.STOCK, quantity: "1.00001", averageBuyPrice: "1e3" }), [
      { field: "quantity", message: "Quantity can have at most 4 decimal places." },
      { field: "averageBuyPrice", message: "Average buy price must be a number." }
    ]);
  });

  it("cash: account label and balance are required; the label has a maximum length", async () => {
    const { auth } = await createLoggedInUser();
    expectFieldErrors(await post(auth, { assetType: "CASH" }), [
      { field: "accountLabel", message: "Account label is required." },
      { field: "value", message: "Value is required." }
    ]);
    expectFieldErrors(await post(auth, { ...VALID.CASH, accountLabel: "a".repeat(151), value: "-1" }), [
      { field: "accountLabel", message: "Account label must be at most 150 characters." },
      { field: "value", message: "Value cannot be negative." }
    ]);
  });

  it("the database also blocks invalid values when the API is bypassed (TC-Asset-02)", async () => {
    const { user } = await createLoggedInUser();
    const insert = (column, value) =>
      pool.query(`INSERT INTO assets (user_id, asset_name, asset_type, value, ${column}) VALUES ($1, 'x', 'GOLD', 1, $2)`, [
        user.id,
        value
      ]);
    await expect(insert("weight_grams", -1)).rejects.toThrow(/ck_assets_weight_grams/);
    await expect(insert("purity_karat", 25)).rejects.toThrow(/ck_assets_purity_karat/);
    await expect(insert("form", "BISCUIT")).rejects.toThrow(/ck_assets_gold_form/);
    await expect(insert("quantity", 0)).rejects.toThrow(/ck_assets_quantity/);
    await expect(insert("purchase_price", -1)).rejects.toThrow(/ck_assets_purchase_price/);
    await expect(
      pool.query("INSERT INTO assets (user_id, asset_name, asset_type, value) VALUES ($1, 'x', 'banana', 1)", [user.id])
    ).rejects.toThrow(/ck_assets_asset_type/);
    await expect(
      pool.query("INSERT INTO assets (user_id, asset_name, asset_type, value) VALUES ($1, 'x', 'CASH', -1)", [user.id])
    ).rejects.toThrow(/ck_assets_value_non_negative/);
  });
});

describe("PUT /api/assets/:id (TC-Asset-01)", () => {
  it("a partial update keeps the other fields", async () => {
    const { auth } = await createLoggedInUser();
    const created = (await post(auth, VALID.GOLD)).body.data;

    const res = await put(auth, created.id, { weightGrams: "25.500", value: "150000.00" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect((await getOne(auth, created.id)).body).toMatchObject({
      form: "COIN",
      purityKarat: 22,
      weightGrams: "25.500",
      purchasePrice: "110000.00",
      currentValue: "150000.00"
    });
  });

  it("invalid fields are rejected per type and nothing changes", async () => {
    const { auth } = await createLoggedInUser();
    const created = (await post(auth, VALID.STOCK)).body.data;

    expectFieldErrors(await put(auth, created.id, { ticker: "BAD TICKER", quantity: "-3" }), [
      { field: "ticker", message: 'Ticker must be 1 to 20 letters or digits (also "&", "-" or "."), like RELIANCE.' },
      { field: "quantity", message: "Quantity cannot be negative." }
    ]);
    expectFieldErrors(await put(auth, created.id, { assetType: "banana" }), [
      { field: "assetType", message: "Asset type must be one of REAL_ESTATE, GOLD, STOCK, CASH." }
    ]);
    expectFieldErrors(await put(auth, created.id, { ticker: null }), [{ field: "ticker", message: "Ticker is required." }]);

    expect((await getOne(auth, created.id)).body).toMatchObject({ ticker: "RELIANCE", quantity: "10", assetType: "STOCK" });
  });

  it("changing the type needs the new type's fields and clears the old ones", async () => {
    const { auth } = await createLoggedInUser();
    const created = (await post(auth, VALID.STOCK)).body.data;

    expectFieldErrors(await put(auth, created.id, { assetType: "CASH" }), [
      { field: "accountLabel", message: "Account label is required." }
    ]);

    const res = await put(auth, created.id, { assetType: "CASH", accountLabel: "Broker cash" });
    expect(res.status).toBe(200);
    expect((await getOne(auth, created.id)).body).toMatchObject({
      assetType: "CASH",
      accountLabel: "Broker cash",
      ticker: null,
      exchange: null,
      quantity: null,
      averageBuyPrice: null,
      name: "RELIANCE"
    });
  });

  it("another user's asset can be neither read nor updated (404, unchanged)", async () => {
    const owner = await createLoggedInUser("owner@example.com");
    const intruder = await createLoggedInUser("intruder@example.com");
    const created = (await post(owner.auth, VALID.CASH)).body.data;

    expect((await getOne(intruder.auth, created.id)).status).toBe(404);
    const res = await put(intruder.auth, created.id, { value: "1.00", accountLabel: "Mine now" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    // An invalid body is still 404: the answer never confirms the asset exists.
    expect((await put(intruder.auth, created.id, { value: "-1" })).status).toBe(404);

    expect((await getOne(owner.auth, created.id)).body).toMatchObject({ accountLabel: "Savings account", currentValue: "150000.00" });
  });

  it("a soft-deleted asset cannot be updated, read or listed", async () => {
    const { auth } = await createLoggedInUser();
    const created = (await post(auth, VALID.CASH)).body.data;
    await request(app).delete(`/api/assets/${created.id}`).set("Authorization", auth);

    expect((await put(auth, created.id, { value: "1.00" })).status).toBe(404);
    expect((await getOne(auth, created.id)).status).toBe(404);
    expect((await request(app).get("/api/assets").set("Authorization", auth)).body.total).toBe(0);
    const { rows } = await pool.query("SELECT value FROM assets WHERE id = $1", [created.id]);
    expect(rows[0].value).toBe("150000.00");
  });

  it("an asset stored before B22 must be completed on its first edit", async () => {
    const { auth, user } = await createLoggedInUser();
    const { rows } = await pool.query(
      "INSERT INTO assets (user_id, asset_name, asset_type, value) VALUES ($1, 'Old flat', 'REAL_ESTATE', 100) RETURNING id",
      [user.id]
    );
    const id = rows[0].id;

    expectFieldErrors(await put(auth, id, { value: "200.00" }), [
      { field: "location", message: "Location is required." },
      { field: "purchaseValue", message: "Purchase value is required." }
    ]);
    const res = await put(auth, id, { value: "200.00", location: "Mysuru", purchaseValue: "90.00" });
    expect(res.status).toBe(200);
    expect((await getOne(auth, id)).body).toMatchObject({ location: "Mysuru", purchaseValue: "90.00", currentValue: "200.00" });
  });
});

describe("the dashboard and exports still work with typed assets", () => {
  it("dashboard totals and allocation include one asset of each type (TC-Dash-01)", async () => {
    const { auth } = await createLoggedInUser();
    for (const body of Object.values(VALID)) expect((await post(auth, body)).status).toBe(201);

    const { body } = await request(app).get("/api/dashboard").set("Authorization", auth);
    expect(body.netWorth).toBe("8498500.00");
    expect(body.allocation.map((slice) => slice.assetType)).toEqual(["REAL_ESTATE", "CASH", "GOLD", "STOCK"]);
  });

  it("the CSV export still lists the assets with the existing columns", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "GOLD", assetName: "Wedding necklace", form: "JEWELLERY", value: "300000.00" });

    const res = await request(app).get("/api/reports/export/csv").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Wedding necklace");
    expect(res.text).toContain("GOLD");
    expect(res.text).toContain("300000.00");
  });
});
