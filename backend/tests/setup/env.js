// Runs before each test file, before the app is loaded.
// reportRoutes.js refuses to load without JWT_SECRET, so the tests make up
// a random one per run (no secret is stored in the repository).
const crypto = require("crypto");

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
}
