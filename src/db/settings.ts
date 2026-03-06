import type Database from "better-sqlite3";

export class GatewaySettings {
  constructor(private db: Database.Database) {
    // Ensure settings table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gateway_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Seed default: API enabled
    const existing = this.db
      .prepare("SELECT value FROM gateway_settings WHERE key = ?")
      .get("api_enabled");
    if (!existing) {
      this.db
        .prepare(
          "INSERT INTO gateway_settings (key, value) VALUES (?, ?)",
        )
        .run("api_enabled", "1");
    }
  }

  isApiEnabled(): boolean {
    const row = this.db
      .prepare("SELECT value FROM gateway_settings WHERE key = ?")
      .get("api_enabled") as { value: string } | undefined;
    return row?.value !== "0";
  }

  setApiEnabled(enabled: boolean): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO gateway_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
      )
      .run("api_enabled", enabled ? "1" : "0");
  }

  get(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM gateway_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO gateway_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
      )
      .run(key, value);
  }
}
