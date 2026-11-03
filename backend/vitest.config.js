// Backend API tests (B14). They run against a real, throwaway PostgreSQL
// database, configured only through the environment:
//   DB_HOST, DB_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
// POSTGRES_DB must end in "_test": globalSetup DROPS and recreates it.
// The user needs CREATEDB (or superuser) rights.
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    globalSetup: ["tests/setup/globalSetup.js"],
    setupFiles: ["tests/setup/env.js"],
    // Every test file shares one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 60000
  }
});
