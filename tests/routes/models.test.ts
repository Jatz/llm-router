import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers.js";

describe("GET /v1/models", () => {
  it("rejects without auth", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(401);
  });

  it("returns model list with admin key", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/v1/models")
      .set("Authorization", "Bearer test-admin-key");
    expect(res.status).toBe(200);
    expect(res.body.object).toBe("list");
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
