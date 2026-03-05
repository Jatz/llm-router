import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry.js";
import type { ProviderAdapter } from "../../src/providers/types.js";

function mockProvider(name: string): ProviderAdapter {
  return {
    name,
    listModels: async () => [
      { id: `${name}/model1`, object: "model" as const, created: 0, owned_by: name },
    ],
    chatCompletion: async () => ({} as any),
    chatCompletionStream: async function* () {},
    healthCheck: async () => true,
  };
}

describe("ProviderRegistry", () => {
  it("routes model ID to correct provider", () => {
    const registry = new ProviderRegistry();
    registry.register("ollama", mockProvider("ollama"));

    const result = registry.resolve("ollama/deepseek-r1:70b");
    expect(result?.provider.name).toBe("ollama");
    expect(result?.modelId).toBe("deepseek-r1:70b");
  });

  it("returns null for unknown provider prefix", () => {
    const registry = new ProviderRegistry();
    expect(registry.resolve("unknown/model")).toBeNull();
  });

  it("returns null for model ID without slash", () => {
    const registry = new ProviderRegistry();
    expect(registry.resolve("noslash")).toBeNull();
  });

  it("lists all models from all providers", async () => {
    const registry = new ProviderRegistry();
    registry.register("test", mockProvider("test"));

    const models = await registry.listAllModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("test/model1");
  });
});
