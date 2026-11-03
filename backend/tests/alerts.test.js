import { beforeEach, describe, expect, it } from "vitest";
const {
  request,
  resetDatabase,
  createLoggedInUser
} = require("./helpers");

beforeEach(resetDatabase);

describe("User alerts API (B12)", () => {
  it("requires authentication to list alerts", async () => {
    const res = await request(request.app || require("../src/app"))
      .get("/api/alerts");

    expect(res.status).toBe(401);
  });

  it("requires authentication to create alerts", async () => {
    const res = await request(require("../src/app"))
      .post("/api/alerts")
      .send({
        assetType: "stock",
        condition: "ABOVE",
        targetPrice: 100
      });

    expect(res.status).toBe(401);
  });

  it("saves an alert and returns it when listing alerts", async () => {
    const user = await createLoggedInUser("alerts1@example.com");

    const created = await request(require("../src/app"))
      .post("/api/alerts")
      .set("Authorization", user.auth)
      .send({
        assetType: "stock",
        condition: "ABOVE",
        targetPrice: 150
      });

    expect(created.status).toBe(201);
    expect(created.body.data.assetType).toBe("stock");
    expect(created.body.data.condition).toBe("ABOVE");
    expect(Number(created.body.data.targetPrice)).toBe(150);

    const listed = await request(require("../src/app"))
      .get("/api/alerts")
      .set("Authorization", user.auth);

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(created.body.data.id);
  });

  it("does not allow one user to see another user's alerts", async () => {
    const userA = await createLoggedInUser("alertsA@example.com");
    const userB = await createLoggedInUser("alertsB@example.com");

    await request(require("../src/app"))
      .post("/api/alerts")
      .set("Authorization", userA.auth)
      .send({
        assetType: "gold",
        condition: "BELOW",
        targetPrice: 7000
      });

    const response = await request(require("../src/app"))
      .get("/api/alerts")
      .set("Authorization", userB.auth);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it("uses the authenticated user instead of a supplied userId", async () => {
    const userA = await createLoggedInUser("alertsOwner@example.com");
    const userB = await createLoggedInUser("alertsOther@example.com");

    const created = await request(require("../src/app"))
      .post("/api/alerts")
      .set("Authorization", userA.auth)
      .send({
        userId: userB.user.id,
        assetType: "stock",
        condition: "BELOW",
        targetPrice: 100
      });

    expect(created.status).toBe(201);

    const userBAlerts = await request(require("../src/app"))
      .get("/api/alerts")
      .set("Authorization", userB.auth);

    expect(userBAlerts.body.data).toHaveLength(0);
  });

  it("rejects invalid asset types", async () => {
    const user = await createLoggedInUser("alertsInvalid1@example.com");

    const res = await request(require("../src/app"))
      .post("/api/alerts")
      .set("Authorization", user.auth)
      .send({
        assetType: "crypto",
        condition: "ABOVE",
        targetPrice: 100
      });

    expect(res.status).toBe(400);
  });

  it("rejects invalid conditions", async () => {
    const user = await createLoggedInUser("alertsInvalid2@example.com");

    const res = await request(require("../src/app"))
      .post("/api/alerts")
      .set("Authorization", user.auth)
      .send({
        assetType: "stock",
        condition: "EQUAL",
        targetPrice: 100
      });

    expect(res.status).toBe(400);
  });

  it("rejects zero and invalid target prices", async () => {
    const user = await createLoggedInUser("alertsInvalid3@example.com");

    for (const targetPrice of [0, -10, "abc", 10.123]) {
      const res = await request(require("../src/app"))
        .post("/api/alerts")
        .set("Authorization", user.auth)
        .send({
          assetType: "stock",
          condition: "ABOVE",
          targetPrice
        });

      expect(res.status).toBe(400);
    }
  });
});
