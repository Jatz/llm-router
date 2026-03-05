import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers.js";

const ADMIN_KEY = "test-admin-key";

describe("E2E smoke tests", () => {
  it("health check returns 200 without auth", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("/v1/models returns 401 without auth", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(401);
  });

  it("admin can create an API key", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "smoke-test-key" });
    expect(res.status).toBe(201);
    expect(res.body.key).toBeDefined();
    expect(res.body.name).toBe("smoke-test-key");
  });

  it("created API key can access /v1/models", async () => {
    const { app } = createTestApp();

    // Create a key
    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "models-access-key" });
    const apiKey = createRes.body.key;

    // Use the key to access /v1/models
    const modelsRes = await request(app)
      .get("/v1/models")
      .set("Authorization", `Bearer ${apiKey}`);
    // May fail to reach Ollama in test, but auth should pass (not 401)
    expect(modelsRes.status).not.toBe(401);
  });

  it("created API key can access /v1/chat/completions", async () => {
    const { app } = createTestApp();

    // Create a key
    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "chat-access-key" });
    const apiKey = createRes.body.key;

    // Use the key to hit chat completions with an unknown provider
    const chatRes = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        model: "unknown/test-model",
        messages: [{ role: "user", content: "Hello" }],
      });
    // 404 for unknown provider is expected — proves the route works with auth
    expect(chatRes.status).toBe(404);
  });

  it("invalid key gets 401", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get("/v1/models")
      .set("Authorization", "Bearer totally-bogus-key");
    expect(res.status).toBe(401);
  });

  it("admin can list keys", async () => {
    const { app } = createTestApp();

    // Create a couple of keys first
    await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "key-alpha" });
    await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "key-beta" });

    const listRes = await request(app)
      .get("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toBeInstanceOf(Array);
    expect(listRes.body.data.length).toBe(2);
  });

  it("admin can revoke a key", async () => {
    const { app } = createTestApp();

    // Create a key
    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "revoke-me" });
    const keyId = createRes.body.id;

    // Revoke it
    const revokeRes = await request(app)
      .delete(`/v1/admin/keys/${keyId}`)
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.message).toBe("Key revoked");
  });

  it("revoked key gets 401", async () => {
    const { app } = createTestApp();

    // Create a key
    const createRes = await request(app)
      .post("/v1/admin/keys")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ name: "will-be-revoked" });
    const apiKey = createRes.body.key;
    const keyId = createRes.body.id;

    // Verify it works before revocation
    const beforeRes = await request(app)
      .get("/v1/models")
      .set("Authorization", `Bearer ${apiKey}`);
    expect(beforeRes.status).not.toBe(401);

    // Revoke it
    await request(app)
      .delete(`/v1/admin/keys/${keyId}`)
      .set("Authorization", `Bearer ${ADMIN_KEY}`);

    // Verify it no longer works
    const afterRes = await request(app)
      .get("/v1/models")
      .set("Authorization", `Bearer ${apiKey}`);
    expect(afterRes.status).toBe(401);
  });
});
