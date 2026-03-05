import type {
  ProviderAdapter,
  OpenAIModel,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "./types.js";
import pino from "pino";

const logger = pino({ name: "openrouter-adapter" });
const BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = "openrouter";

  constructor(private apiKey: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenRouter /models returned ${res.status}`);
    const data = (await res.json()) as {
      data: Array<{ id: string; created: number }>;
    };
    return data.data.map((m) => ({
      id: `openrouter/${m.id}`,
      object: "model" as const,
      created: m.created ?? 0,
      owned_by: "openrouter",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `OpenRouter chat completion failed (${res.status}): ${body}`,
      );
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async *chatCompletionStream(
    req: OpenAIChatRequest,
  ): AsyncIterable<OpenAIChatChunk> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `OpenRouter streaming failed (${res.status}): ${body}`,
      );
    }
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            yield JSON.parse(data) as OpenAIChatChunk;
          } catch {
            logger.warn({ data }, "failed to parse OpenRouter SSE chunk");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
