import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import { KeyStore } from "../../src/db/keys.js";

describe("KeyStore", () => {
  let keyStore: KeyStore;

  beforeEach(() => {
    const db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    keyStore = new KeyStore(db);
  });

  it("creates a key and returns it", () => {
    const { key, record } = keyStore.create("test-key");
    expect(key).toMatch(/^llm-/);
    expect(record.name).toBe("test-key");
    expect(record.key_prefix).toBe(key.slice(0, 8));
    expect(record.revoked).toBe(0);
  });

  it("validates a correct key", () => {
    const { key } = keyStore.create("test-key");
    const record = keyStore.validate(key);
    expect(record).not.toBeNull();
    expect(record!.name).toBe("test-key");
  });

  it("rejects an invalid key", () => {
    const record = keyStore.validate("llm-invalid");
    expect(record).toBeNull();
  });

  it("rejects a revoked key", () => {
    const { key, record } = keyStore.create("test-key");
    keyStore.revoke(record.id);
    const result = keyStore.validate(key);
    expect(result).toBeNull();
  });

  it("lists all keys", () => {
    keyStore.create("key-1");
    keyStore.create("key-2");
    const keys = keyStore.list();
    expect(keys).toHaveLength(2);
  });

  it("creates key with rate limit", () => {
    const { record } = keyStore.create("limited-key", 100);
    expect(record.rate_limit).toBe(100);
  });
});
