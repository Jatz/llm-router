import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers.js";

describe("Admin API", () => {
  it("rejects non-admin access", async () => {
    const { app, keyStore } = createTestApp();
    const { key } = keyStore.create("regular-user");

    const res = await request(app)
      .get("/v1/admin/keys")
      .set("Authorization", `Bearer ${key}`);
    expect(res.status).toBe(403);
  });

  it("creates and lists API keys", async () => {
    const { app } = createTestApp();

    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", "Bearer test-admin-key")
      .send({ name: "cursor-laptop" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.key).toMatch(/^llm-/);
    expect(createRes.body.name).toBe("cursor-laptop");

    const listRes = await request(app)
      .get("/v1/admin/keys")
      .set("Authorization", "Bearer test-admin-key");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
  });

  it("revokes a key", async () => {
    const { app } = createTestApp();

    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", "Bearer test-admin-key")
      .send({ name: "temp-key" });
    const keyId = createRes.body.id;

    const revokeRes = await request(app)
      .delete(`/v1/admin/keys/${keyId}`)
      .set("Authorization", "Bearer test-admin-key");
    expect(revokeRes.status).toBe(200);

    // Verify key no longer works
    const modelsRes = await request(app)
      .get("/v1/models")
      .set("Authorization", `Bearer ${createRes.body.key}`);
    expect(modelsRes.status).toBe(401);
  });
});
