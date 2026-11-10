// Shared helpers for the API tests.
const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");
const { truncateAll } = require("./setup/testDb");

const PASSWORD = "GreenTea2026x";

async function resetDatabase() {
  await truncateAll(pool);
}

async function registerUser(overrides = {}) {
  const body = { name: "Test User", email: "user@example.com", password: PASSWORD, ...overrides };
  return request(app).post("/api/auth/register").send(body);
}

// Registers and logs in; returns { token, user, auth } where auth is the header value.
async function createLoggedInUser(email = "user@example.com", password = PASSWORD) {
  const reg = await registerUser({ email, password });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const login = await request(app).post("/api/auth/login").send({ email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  return { token: login.body.token, user: login.body.user, auth: `Bearer ${login.body.token}` };
}

// B22: each asset type has its own required fields (PWM-F-010 to PWM-F-013).
// Tests that only care about name, type and value get valid details from here.
const TYPE_DEFAULTS = {
  REAL_ESTATE: { location: "Chennai", purchaseValue: "4000000.00", purchaseDate: "2021-03-15" },
  GOLD: { form: "COIN", purityKarat: 22, weightGrams: "20.000", purchasePrice: "110000.00" },
  STOCK: { ticker: "RELIANCE", quantity: "10", averageBuyPrice: "2800.00" },
  CASH: { accountLabel: "Savings account" }
};

async function createAsset(auth, overrides = {}) {
  const type = String(overrides.assetType ?? "REAL_ESTATE").trim().toUpperCase();
  const body = { assetName: "Flat", assetType: "REAL_ESTATE", value: 5000000, ...TYPE_DEFAULTS[type], ...overrides };
  const res = await request(app).post("/api/assets").set("Authorization", auth).send(body);
  if (res.status !== 201) throw new Error(`create asset failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

module.exports = { app, pool, request, PASSWORD, TYPE_DEFAULTS, resetDatabase, registerUser, createLoggedInUser, createAsset };
