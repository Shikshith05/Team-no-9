// Load environment variables from the project root before database setup.
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env")
});

const { createFreshDatabase, dropDatabase } = require("./testDb");

module.exports = async function setup() {
  const files = await createFreshDatabase();
  console.log(`Test database ready (${files.length} migrations applied).`);

  return async function teardown() {
    await dropDatabase();
  };
};