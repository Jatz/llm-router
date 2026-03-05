import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import pino from "pino";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const config = loadConfig();
const logger = pino({ level: config.logLevel });

// Ensure data directory exists for SQLite
mkdirSync(dirname(config.dbPath), { recursive: true });

const { app } = createApp(config);

const server = app.listen(config.port, config.host, () => {
  logger.info(`LLM Gateway listening on http://${config.host}:${config.port}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, "shutting down gracefully");
  server.close(() => {
    logger.info("server closed");
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    logger.warn("forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
