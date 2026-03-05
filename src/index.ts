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

app.listen(config.port, config.host, () => {
  logger.info(`LLM Gateway listening on http://${config.host}:${config.port}`);
});
