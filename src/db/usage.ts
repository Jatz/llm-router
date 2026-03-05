import type Database from "better-sqlite3";

interface UsageEntry {
  keyId: number;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

interface UsageStats {
  model: string;
  provider: string;
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export type { UsageEntry, UsageStats };

export class UsageLogger {
  private insertStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO usage_log (key_id, model, provider, prompt_tokens, completion_tokens, total_tokens, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  log(entry: UsageEntry): void {
    this.insertStmt.run(
      entry.keyId,
      entry.model,
      entry.provider,
      entry.promptTokens ?? null,
      entry.completionTokens ?? null,
      entry.totalTokens ?? null,
      entry.latencyMs ?? null,
    );
  }

  getStats(filter?: { keyId?: number }): UsageStats[] {
    let sql = `
      SELECT model, provider,
        COUNT(*) as totalRequests,
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COALESCE(CAST(AVG(latency_ms) AS INTEGER), 0) as avgLatencyMs
      FROM usage_log
    `;
    const params: unknown[] = [];
    if (filter?.keyId) {
      sql += " WHERE key_id = ?";
      params.push(filter.keyId);
    }
    sql += " GROUP BY model, provider ORDER BY totalRequests DESC";
    return this.db.prepare(sql).all(...params) as UsageStats[];
  }

  purge(olderThanDays: number): number {
    const result = this.db
      .prepare(
        "DELETE FROM usage_log WHERE created_at < datetime('now', ?)",
      )
      .run(`-${olderThanDays} days`);
    return result.changes;
  }
}
