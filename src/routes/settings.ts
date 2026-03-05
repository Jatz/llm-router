import { Router } from "express";
import type { Config } from "../config.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function settingsRouter(
  config: Config,
  registry: ProviderRegistry,
): Router {
  const router = Router();

  // Only admin can view settings
  router.use((req, res, next) => {
    if (!(req as AuthenticatedRequest).isAdmin) {
      res.status(403).json({
        error: {
          message: "Admin access required",
          type: "permission_error",
          code: "forbidden",
        },
      });
      return;
    }
    next();
  });

  router.get("/", async (_req, res) => {
    const providers = registry.getProviders();
    const providerStatus: Record<
      string,
      { configured: boolean; healthy: boolean; key?: string | null }
    > = {};

    for (const [name, adapter] of providers) {
      let healthy = false;
      try {
        healthy = await adapter.healthCheck();
      } catch {
        // unhealthy
      }

      providerStatus[name] = {
        configured: true,
        healthy,
      };
    }

    // Show which providers are configured and their masked keys
    if (config.openrouterApiKey) {
      if (providerStatus.openrouter) {
        providerStatus.openrouter.key = maskKey(config.openrouterApiKey);
      }
    } else {
      providerStatus.openrouter = {
        configured: false,
        healthy: false,
        key: null,
      };
    }

    if (config.minimaxApiKey) {
      if (providerStatus.minimax) {
        providerStatus.minimax.key = maskKey(config.minimaxApiKey);
      }
    } else {
      providerStatus.minimax = {
        configured: false,
        healthy: false,
        key: null,
      };
    }

    // Ollama and Claude don't use API keys — show URL status
    if (providerStatus.ollama) {
      (providerStatus.ollama as Record<string, unknown>).url =
        config.ollamaUrl;
    }
    if (providerStatus.claude) {
      (providerStatus.claude as Record<string, unknown>).url =
        config.claudeProxyUrl;
    }

    res.json({
      gateway: {
        version: "0.1.0",
        port: config.port,
        logLevel: config.logLevel,
        adminKey: maskKey(config.adminApiKey),
      },
      providers: providerStatus,
    });
  });

  return router;
}
