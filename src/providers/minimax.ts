import type {
  ProviderAdapter,
  OpenAIModel,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "./types.js";
import pino from "pino";

const logger = pino({ name: "minimax-adapter" });
const BASE_URL = "https://api.minimax.chat/v1";

const MINIMAX_MODELS = [
  { id: "MiniMax-M1", created: 0 },
  { id: "MiniMax-M1-40k", created: 0 },
];

export class MiniMaxAdapter implements ProviderAdapter {
  readonly name = "minimax";

  constructor(private apiKey: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    return MINIMAX_MODELS.map((m) => ({
      id: `minimax/${m.id}`,
      object: "model" as const,
      created: m.created,
      owned_by: "minimax",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const res = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
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
        `MiniMax chat completion failed (${res.status}): ${body}`,
      );
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async *chatCompletionStream(
    req: OpenAIChatRequest,
  ): AsyncIterable<OpenAIChatChunk> {
    const res = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
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
        `MiniMax streaming failed (${res.status}): ${body}`,
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
            logger.warn({ data }, "failed to parse MiniMax SSE chunk");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    // Static model list — if API key is configured, consider it healthy.
    // Avoids sending a real chat completion which costs tokens on every
    // /v1/models call.
    return !!this.apiKey;
  }
}
