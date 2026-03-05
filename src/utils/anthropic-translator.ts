import type {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "../providers/types.js";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
  usage: { input_tokens: number; output_tokens: number };
}

export type { AnthropicRequest, AnthropicResponse };

export function openaiToAnthropic(req: OpenAIChatRequest): AnthropicRequest {
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];

  for (const msg of req.messages) {
    if (msg.role === "system") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : (msg.content as Array<{ text?: string }>)
              .map((c) => c.text ?? "")
              .join("");
      system = system ? `${system}\n${text}` : text;
    } else if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role,
        content: msg.content as string,
      });
    }
  }

  // Strip provider prefix from model ID (e.g. "opus" stays "opus")
  const model = req.model;

  const result: AnthropicRequest = { model, messages };
  if (system) result.system = system;
  if (req.max_tokens) result.max_tokens = req.max_tokens;
  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;
  if (req.stop)
    result.stop_sequences = Array.isArray(req.stop) ? req.stop : [req.stop];

  return result;
}

const STOP_REASON_MAP: Record<string, "stop" | "length"> = {
  end_turn: "stop",
  max_tokens: "length",
  stop_sequence: "stop",
};

export function anthropicToOpenai(
  anthropicRes: AnthropicResponse,
  originalModel: string,
): OpenAIChatResponse {
  const content = anthropicRes.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  return {
    id: `chatcmpl-${anthropicRes.id}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: originalModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason:
          STOP_REASON_MAP[anthropicRes.stop_reason ?? ""] ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: anthropicRes.usage.input_tokens,
      completion_tokens: anthropicRes.usage.output_tokens,
      total_tokens:
        anthropicRes.usage.input_tokens + anthropicRes.usage.output_tokens,
    },
  };
}

export function makeOpenaiStreamChunk(
  id: string,
  model: string,
  delta: { role?: "assistant"; content?: string },
  finishReason: "stop" | "length" | null = null,
): OpenAIChatChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}
