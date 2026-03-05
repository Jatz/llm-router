import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import { UsageLogger } from "../../src/db/usage.js";

describe("UsageLogger", () => {
  let db: Database.Database;
  let logger: UsageLogger;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    logger = new UsageLogger(db);
  });

  function createKey(name: string, hash: string, prefix: string) {
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)",
    ).run(name, hash, prefix);
  }

  it("logs a usage record", () => {
    createKey("test", "hash123", "llm-1234");

    logger.log({
      keyId: 1,
      model: "ollama/deepseek-r1:70b",
      provider: "ollama",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 1200,
    });

    const rows = db
      .prepare("SELECT * FROM usage_log WHERE key_id = ?")
      .all(1) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "ollama/deepseek-r1:70b",
      provider: "ollama",
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      latency_ms: 1200,
    });
  });

  it("logs with optional fields as null", () => {
    createKey("test", "hash123", "llm-1234");

    logger.log({
      keyId: 1,
      model: "claude/opus",
      provider: "claude",
    });

    const rows = db
      .prepare("SELECT * FROM usage_log WHERE key_id = ?")
      .all(1) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].prompt_tokens).toBeNull();
    expect(rows[0].total_tokens).toBeNull();
    expect(rows[0].latency_ms).toBeNull();
  });

  it("returns usage stats grouped by model", () => {
    createKey("test", "hash123", "llm-1234");

    logger.log({
      keyId: 1,
      model: "ollama/qwen",
      provider: "ollama",
      totalTokens: 100,
      latencyMs: 500,
    });
    logger.log({
      keyId: 1,
      model: "ollama/qwen",
      provider: "ollama",
      totalTokens: 200,
      latencyMs: 600,
    });
    logger.log({
      keyId: 1,
      model: "claude/opus",
      provider: "claude",
      totalTokens: 50,
      latencyMs: 2000,
    });

    const stats = logger.getStats();
    expect(stats).toHaveLength(2);
    const qwen = stats.find((s) => s.model === "ollama/qwen");
    expect(qwen?.totalRequests).toBe(2);
    expect(qwen?.totalTokens).toBe(300);
  });

  it("returns usage stats filtered by key ID", () => {
    createKey("key1", "hash1", "llm-1111");
    createKey("key2", "hash2", "llm-2222");

    logger.log({
      keyId: 1,
      model: "ollama/qwen",
      provider: "ollama",
      totalTokens: 100,
      latencyMs: 500,
    });
    logger.log({
      keyId: 2,
      model: "claude/opus",
      provider: "claude",
      totalTokens: 50,
      latencyMs: 2000,
    });

    const stats = logger.getStats({ keyId: 1 });
    expect(stats).toHaveLength(1);
    expect(stats[0].model).toBe("ollama/qwen");
  });

  it("purges old usage records", () => {
    createKey("test", "hash123", "llm-1234");

    // Insert a record with an old timestamp
    db.prepare(
      "INSERT INTO usage_log (key_id, model, provider, total_tokens, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))",
    ).run(1, "ollama/qwen", "ollama", 100, 500);

    // Insert a recent record
    logger.log({
      keyId: 1,
      model: "claude/opus",
      provider: "claude",
      totalTokens: 50,
      latencyMs: 200,
    });

    const deleted = logger.purge(7); // purge older than 7 days
    expect(deleted).toBe(1);

    const rows = db.prepare("SELECT * FROM usage_log").all();
    expect(rows).toHaveLength(1); // recent record survives
  });
});
