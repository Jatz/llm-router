import type { ProviderAdapter, OpenAIModel } from "./types.js";
import pino from "pino";

const logger = pino({ name: "provider-registry" });

export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();

  register(prefix: string, provider: ProviderAdapter): void {
    this.providers.set(prefix, provider);
    logger.info({ prefix, provider: provider.name }, "registered provider");
  }

  resolve(
    modelId: string,
  ): { provider: ProviderAdapter; modelId: string } | null {
    const slashIndex = modelId.indexOf("/");
    if (slashIndex === -1) return null;

    const prefix = modelId.substring(0, slashIndex);
    const provider = this.providers.get(prefix);
    if (!provider) return null;

    return { provider, modelId: modelId.substring(slashIndex + 1) };
  }

  async listAllModels(): Promise<OpenAIModel[]> {
    const results: OpenAIModel[] = [];
    for (const [prefix, provider] of this.providers) {
      try {
        const healthy = await provider.healthCheck();
        if (!healthy) {
          logger.warn({ prefix }, "provider unhealthy, skipping model listing");
          continue;
        }
        const models = await provider.listModels();
        results.push(...models);
      } catch (err) {
        logger.error({ prefix, err }, "failed to list models");
      }
    }
    return results;
  }

  getProviders(): Map<string, ProviderAdapter> {
    return this.providers;
  }
}
