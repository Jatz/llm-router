import type {
  ProviderAdapter,
  OpenAIModel,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "./types.js";
import pino from "pino";

const logger = pino({ name: "ollama-adapter" });

export class OllamaAdapter implements ProviderAdapter {
  readonly name = "ollama";

  constructor(private baseUrl: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
    const data = (await res.json()) as {
      models: Array<{ name: string; modified_at: string }>;
    };
    return data.models.map((m) => ({
      id: `ollama/${m.name}`,
      object: "model" as const,
      created: Math.floor(new Date(m.modified_at).getTime() / 1000),
      owned_by: "ollama",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Ollama chat completion failed (${res.status}): ${body}`,
      );
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async *chatCompletionStream(
    req: OpenAIChatRequest,
  ): AsyncIterable<OpenAIChatChunk> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama streaming failed (${res.status}): ${body}`);
    }
    if (!res.body) throw new Error("No response body for streaming");

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
            logger.warn({ data }, "failed to parse SSE chunk");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
