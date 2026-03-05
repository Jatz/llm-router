import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";

export function createTestApp() {
  const config: Config = {
    port: 3000,
    host: "0.0.0.0",
    logLevel: "silent",
    adminApiKey: "test-admin-key",
    ollamaUrl: "http://localhost:11434",
    claudeProxyUrl: "http://localhost:9789",
    dbPath: ":memory:",
  };
  return createApp(config);
}
