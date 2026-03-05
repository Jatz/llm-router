import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers.js";

describe("POST /v1/chat/completions", () => {
  it("rejects request without auth", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "ollama/test", messages: [{ role: "user", content: "Hi" }] });
    expect(res.status).toBe(401);
  });

  it("rejects request without model", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-admin-key")
      .send({ messages: [{ role: "user", content: "Hi" }] });
    expect(res.status).toBe(400);
  });

  it("rejects unknown provider prefix", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-admin-key")
      .send({ model: "unknown/model", messages: [{ role: "user", content: "Hi" }] });
    expect(res.status).toBe(404);
  });
});
