import express from "express";
import pino from "pino";
import type { Config } from "./config.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OllamaAdapter } from "./providers/ollama.js";
import { ClaudeAdapter } from "./providers/claude.js";
import { OpenRouterAdapter } from "./providers/openrouter.js";
import { createDatabase } from "./db/index.js";
import { KeyStore } from "./db/keys.js";
import { healthRouter } from "./routes/health.js";
import { modelsRouter } from "./routes/models.js";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";

export function createApp(config: Config) {
  const app = express();
  const logger = pino({ level: config.logLevel });

  // Database
  const db = createDatabase(config.dbPath);
  const keyStore = new KeyStore(db);

  // Provider registry
  const registry = new ProviderRegistry();
  registry.register("ollama", new OllamaAdapter(config.ollamaUrl));
  registry.register("claude", new ClaudeAdapter(config.claudeProxyUrl));
  if (config.openrouterApiKey) {
    registry.register(
      "openrouter",
      new OpenRouterAdapter(config.openrouterApiKey),
    );
  }

  // Global middleware
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "10mb" }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        ms: Date.now() - start,
      });
    });
    next();
  });

  // Public routes
  app.use("/health", healthRouter);

  // Authenticated routes
  const auth = authMiddleware(keyStore, config.adminApiKey);
  app.use("/v1/models", auth, modelsRouter(registry));
  app.use("/v1/chat/completions", auth, chatRouter(registry));
  app.use("/v1/admin", auth, adminRouter(keyStore));

  // Error handler (must be last)
  app.use(errorHandler);

  return { app, registry, keyStore };
}
