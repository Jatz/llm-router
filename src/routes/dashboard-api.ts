import { Router } from "express";
import type { Config } from "../config.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { KeyStore } from "../db/keys.js";
import type { UsageLogger } from "../db/usage.js";
import type { GatewaySettings } from "../db/settings.js";

function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Dashboard API endpoints — no Bearer auth required.
 * These are accessed by the browser UI, which is protected by Cloudflare SSO.
 * For programmatic access, use /v1/* endpoints with Bearer token auth.
 */
export function dashboardApiRouter(
  config: Config,
  registry: ProviderRegistry,
  keyStore: KeyStore,
  usageLogger: UsageLogger,
  gatewaySettings: GatewaySettings,
): Router {
  const router = Router();

  // GET /api/dashboard/settings — gateway config + provider status
  router.get("/settings", async (_req, res) => {
    const providers = registry.getProviders();
    const providerStatus: Record<
      string,
      { configured: boolean; healthy: boolean; url?: string; key?: string | null }
    > = {};

    for (const [name, adapter] of providers) {
      let healthy = false;
      try {
        healthy = await adapter.healthCheck();
      } catch {
        // unhealthy
      }
      providerStatus[name] = { configured: true, healthy };
    }

    // OpenRouter
    if (config.openrouterApiKey) {
      if (providerStatus.openrouter) {
        providerStatus.openrouter.key = maskKey(config.openrouterApiKey);
      }
    } else {
      providerStatus.openrouter = { configured: false, healthy: false, key: null };
    }

    // MiniMax
    if (config.minimaxApiKey) {
      if (providerStatus.minimax) {
        providerStatus.minimax.key = maskKey(config.minimaxApiKey);
      }
    } else {
      providerStatus.minimax = { configured: false, healthy: false, key: null };
    }

    // Ollama and Claude — show URL
    if (providerStatus.ollama) {
      providerStatus.ollama.url = config.ollamaUrl;
    }
    if (providerStatus.claude) {
      providerStatus.claude.url = config.claudeProxyUrl;
    }

    res.json({
      gateway: {
        version: "0.1.0",
        port: config.port,
        logLevel: config.logLevel,
        adminKey: maskKey(config.adminApiKey),
        apiEnabled: gatewaySettings.isApiEnabled(),
      },
      providers: providerStatus,
    });
  });

  // GET /api/dashboard/keys — list all API keys
  router.get("/keys", (_req, res) => {
    res.json({ data: keyStore.list() });
  });

  // POST /api/dashboard/keys — create a new API key
  router.post("/keys", (req, res) => {
    const { name, rate_limit } = req.body;
    if (!name || typeof name !== "string" || name.length > 255) {
      res.status(400).json({
        error: {
          message: "name is required and must be a string (max 255 chars)",
        },
      });
      return;
    }
    if (
      rate_limit !== undefined &&
      (typeof rate_limit !== "number" ||
        !Number.isInteger(rate_limit) ||
        rate_limit <= 0 ||
        rate_limit > 100000)
    ) {
      res.status(400).json({
        error: {
          message: "rate_limit must be a positive integer up to 100000 (requests/min)",
        },
      });
      return;
    }
    const { key, record } = keyStore.create(name, rate_limit);
    res.status(201).json({ key, ...record });
  });

  // DELETE /api/dashboard/keys/:id — revoke an API key
  router.delete("/keys/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: { message: "Invalid key ID" } });
      return;
    }
    const revoked = keyStore.revoke(id);
    if (!revoked) {
      res.status(404).json({ error: { message: "Key not found" } });
      return;
    }
    res.json({ message: "Key revoked" });
  });

  // GET /api/dashboard/usage — usage stats
  router.get("/usage", (req, res) => {
    const keyIdParam = req.query.key_id;
    const filter = keyIdParam
      ? { keyId: parseInt(keyIdParam as string, 10) }
      : undefined;
    const stats = usageLogger.getStats(filter);
    res.json({ data: stats });
  });

  // POST /api/dashboard/kill-switch — toggle API access
  router.post("/kill-switch", (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      res.status(400).json({
        error: { message: "enabled must be a boolean" },
      });
      return;
    }
    gatewaySettings.setApiEnabled(enabled);
    res.json({
      message: enabled ? "API access enabled" : "API access disabled",
      apiEnabled: enabled,
    });
  });

  return router;
}
