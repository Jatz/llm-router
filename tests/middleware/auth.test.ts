import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers.js";

describe("Auth middleware", () => {
  it("rejects requests without Authorization header", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_api_key");
  });

  it("rejects requests with invalid key", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/v1/models")
      .set("Authorization", "Bearer invalid-key");
    expect(res.status).toBe(401);
  });

  it("allows admin key", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/v1/models")
      .set("Authorization", "Bearer test-admin-key");
    expect(res.status).toBe(200);
  });

  it("allows valid API key created via admin", async () => {
    const { app } = createTestApp();

    // Create a key via admin endpoint
    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", "Bearer test-admin-key")
      .send({ name: "test-client" });
    expect(createRes.status).toBe(201);
    const clientKey = createRes.body.key;

    // Use the client key
    const modelsRes = await request(app)
      .get("/v1/models")
      .set("Authorization", `Bearer ${clientKey}`);
    expect(modelsRes.status).toBe(200);
  });
});
