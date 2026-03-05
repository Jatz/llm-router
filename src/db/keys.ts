import type Database from "better-sqlite3";
import { randomBytes, createHash } from "node:crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: number;
  rate_limit: number | null;
}

export class KeyStore {
  constructor(private db: Database.Database) {}

  create(
    name: string,
    rateLimit?: number,
  ): { key: string; record: ApiKeyRecord } {
    const key = `llm-${randomBytes(24).toString("hex")}`;
    const keyHash = hashKey(key);
    const keyPrefix = key.slice(0, 8);

    const stmt = this.db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix, rate_limit) VALUES (?, ?, ?, ?)",
    );
    const result = stmt.run(name, keyHash, keyPrefix, rateLimit ?? null);

    const record = this.db
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .get(result.lastInsertRowid) as ApiKeyRecord;
    return { key, record };
  }

  validate(key: string): ApiKeyRecord | null {
    const keyHash = hashKey(key);
    const record = this.db
      .prepare("SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0")
      .get(keyHash) as ApiKeyRecord | undefined;

    if (record) {
      this.db
        .prepare(
          "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
        )
        .run(record.id);
    }

    return record ?? null;
  }

  list(): ApiKeyRecord[] {
    return this.db
      .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
      .all() as ApiKeyRecord[];
  }

  revoke(id: number): boolean {
    const result = this.db
      .prepare("UPDATE api_keys SET revoked = 1 WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }
}
