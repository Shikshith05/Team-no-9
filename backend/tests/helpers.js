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

async function createAsset(auth, overrides = {}) {
  const body = { assetName: "Flat", assetType: "real_estate", value: 5000000, ...overrides };
  const res = await request(app).post("/api/assets").set("Authorization", auth).send(body);
  if (res.status !== 201) throw new Error(`create asset failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

module.exports = { app, pool, request, PASSWORD, resetDatabase, registerUser, createLoggedInUser, createAsset };
