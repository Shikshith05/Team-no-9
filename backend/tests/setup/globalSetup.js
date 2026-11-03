// Runs once per `npm test`: build a fresh test database from the
// migrations, and drop it again when the run ends.
const { createFreshDatabase, dropDatabase } = require("./testDb");

module.exports = async function setup() {
  const files = await createFreshDatabase();
  console.log(`Test database ready (${files.length} migrations applied).`);

  return async function teardown() {
    await dropDatabase();
  };
};
