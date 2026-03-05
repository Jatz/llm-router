import type {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatChunk,
} from "../providers/types.js";

interface AnthropicMessage {
  role: "user" | "assistant";
  content:
    | string
    | Array<{
        type: string;
        text?: string;
        source?: { type: string; url: string };
      }>;
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
  // Tool use is not yet supported through the Claude proxy adapter
  if (req.tools && req.tools.length > 0) {
    throw new Error(
      "Tool use is not yet supported for the Claude provider. Remove 'tools' from your request or use a different provider.",
    );
  }

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
    } else if (msg.role === "tool") {
      // Tool results not supported — skip with warning
      continue;
    } else if (msg.role === "user" || msg.role === "assistant") {
      // Handle multipart content (e.g. vision/image requests)
      if (typeof msg.content === "string") {
        messages.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const anthropicContent = msg.content.map((part) => {
          if (part.type === "text") {
            return { type: "text" as const, text: part.text ?? "" };
          }
          if (part.type === "image_url" && part.image_url?.url) {
            return {
              type: "image" as const,
              source: {
                type: "url" as const,
                url: part.image_url.url,
              },
            };
          }
          return { type: "text" as const, text: "" };
        });
        messages.push({ role: msg.role, content: anthropicContent });
      }
    }
  }

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
    usage: anthropicRes.usage
      ? {
          prompt_tokens: anthropicRes.usage.input_tokens,
          completion_tokens: anthropicRes.usage.output_tokens,
          total_tokens:
            anthropicRes.usage.input_tokens +
            anthropicRes.usage.output_tokens,
        }
      : undefined,
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
