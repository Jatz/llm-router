import express from "express";
import pino from "pino";
import type Database from "better-sqlite3";
import type { Config } from "./config.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OllamaAdapter } from "./providers/ollama.js";
import { ClaudeAdapter } from "./providers/claude.js";
import { OpenRouterAdapter } from "./providers/openrouter.js";
import { MiniMaxAdapter } from "./providers/minimax.js";
import { createDatabase } from "./db/index.js";
import { KeyStore } from "./db/keys.js";
import { UsageLogger } from "./db/usage.js";
import { GatewaySettings } from "./db/settings.js";
import { healthRouter } from "./routes/health.js";
import { modelsRouter } from "./routes/models.js";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { dashboardApiRouter } from "./routes/dashboard-api.js";
import { authMiddleware } from "./middleware/auth.js";
import { killSwitchMiddleware } from "./middleware/kill-switch.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./openapi.js";

export function createApp(config: Config) {
  const app = express();
  const logger = pino({ level: config.logLevel });

  // Database
  const db = createDatabase(config.dbPath);
  const keyStore = new KeyStore(db);
  const usageLogger = new UsageLogger(db);
  const gatewaySettings = new GatewaySettings(db);

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
  if (config.minimaxApiKey) {
    registry.register("minimax", new MiniMaxAdapter(config.minimaxApiKey));
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
  app.get("/", (_req, res) => res.redirect("/settings"));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/health", healthRouter(db));
  app.use("/settings", dashboardRouter());

  // Dashboard API — no Bearer auth (Cloudflare SSO protects the browser)
  app.use(
    "/api/dashboard",
    dashboardApiRouter(config, registry, keyStore, usageLogger, gatewaySettings),
  );

  // Kill switch — blocks all /v1/* when API is disabled
  const killSwitch = killSwitchMiddleware(gatewaySettings);

  // Authenticated routes
  const auth = authMiddleware(keyStore, config.adminApiKey);
  const rateLimiter = createRateLimiter();
  app.use("/v1/models", killSwitch, auth, rateLimiter, modelsRouter(registry));
  app.use(
    "/v1/chat/completions",
    killSwitch,
    auth,
    rateLimiter,
    chatRouter(registry, usageLogger),
  );
  app.use("/v1/admin", killSwitch, auth, adminRouter(keyStore, usageLogger));
  app.use(
    "/v1/settings",
    killSwitch,
    auth,
    settingsRouter(config, registry),
  );

  // Error handler (must be last)
  app.use(errorHandler);

  return {
    app,
    db: db as Database.Database,
    registry,
    keyStore,
    usageLogger,
    gatewaySettings,
  };
}
