import type {
  ProviderAdapter,
  OpenAIModel,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "./types.js";
import {
  openaiToAnthropic,
  anthropicToOpenai,
  makeOpenaiStreamChunk,
} from "../utils/anthropic-translator.js";
import type { AnthropicResponse } from "../utils/anthropic-translator.js";
import pino from "pino";

const logger = pino({ name: "claude-adapter" });

const CLAUDE_MODELS = ["opus", "sonnet", "haiku"];

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = "claude";

  constructor(private proxyUrl: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    return CLAUDE_MODELS.map((model) => ({
      id: `claude/${model}`,
      object: "model" as const,
      created: 0,
      owned_by: "anthropic",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const anthropicReq = openaiToAnthropic(req);
    anthropicReq.stream = false;
    if (!anthropicReq.max_tokens) anthropicReq.max_tokens = 4096;

    const res = await fetch(`${this.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anthropicReq),
      signal: req.signal ?? AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude proxy returned ${res.status}: ${body}`);
    }

    const anthropicRes = (await res.json()) as AnthropicResponse;
    return anthropicToOpenai(anthropicRes, `claude/${req.model}`);
  }

  async *chatCompletionStream(
    req: OpenAIChatRequest,
  ): AsyncIterable<OpenAIChatChunk> {
    const anthropicReq = openaiToAnthropic(req);
    anthropicReq.stream = true;
    if (!anthropicReq.max_tokens) anthropicReq.max_tokens = 4096;

    const res = await fetch(`${this.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anthropicReq),
      signal: req.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Claude proxy streaming returned ${res.status}: ${body}`,
      );
    }
    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const chatId = `chatcmpl-${Date.now()}`;
    const model = `claude/${req.model}`;
    let sentRole = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          // Handle "event: <type>" + "data: <json>" format from Claude proxy
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const event = JSON.parse(data);

            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta"
            ) {
              if (!sentRole) {
                yield makeOpenaiStreamChunk(chatId, model, {
                  role: "assistant",
                  content: "",
                });
                sentRole = true;
              }
              yield makeOpenaiStreamChunk(chatId, model, {
                content: event.delta.text,
              });
            } else if (event.type === "message_stop") {
              yield makeOpenaiStreamChunk(chatId, model, {}, "stop");
            }
          } catch {
            logger.warn({ data }, "failed to parse Claude SSE event");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.proxyUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
