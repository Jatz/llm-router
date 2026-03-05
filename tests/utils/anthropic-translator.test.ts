import { describe, it, expect } from "vitest";
import {
  openaiToAnthropic,
  anthropicToOpenai,
  makeOpenaiStreamChunk,
} from "../../src/utils/anthropic-translator.js";

describe("openaiToAnthropic", () => {
  it("extracts system message and converts messages", () => {
    const result = openaiToAnthropic({
      model: "opus",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ],
    });
    expect(result.system).toBe("You are helpful");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("user");
    expect(result.model).toBe("opus");
  });

  it("handles no system message", () => {
    const result = openaiToAnthropic({
      model: "sonnet",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.system).toBeUndefined();
    expect(result.messages).toHaveLength(1);
  });

  it("maps max_tokens and temperature", () => {
    const result = openaiToAnthropic({
      model: "opus",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 1000,
      temperature: 0.7,
    });
    expect(result.max_tokens).toBe(1000);
    expect(result.temperature).toBe(0.7);
  });

  it("converts stop to stop_sequences", () => {
    const result = openaiToAnthropic({
      model: "opus",
      messages: [{ role: "user", content: "Hi" }],
      stop: ["END", "STOP"],
    });
    expect(result.stop_sequences).toEqual(["END", "STOP"]);
  });
});

describe("anthropicToOpenai", () => {
  it("converts Anthropic response to OpenAI format", () => {
    const result = anthropicToOpenai(
      {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello!" }],
        model: "claude-opus-4-20250514",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      "claude/opus",
    );
    expect(result.object).toBe("chat.completion");
    expect(result.choices[0].message.content).toBe("Hello!");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage?.prompt_tokens).toBe(10);
    expect(result.usage?.completion_tokens).toBe(5);
    expect(result.usage?.total_tokens).toBe(15);
  });

  it("maps max_tokens stop reason to length", () => {
    const result = anthropicToOpenai(
      {
        id: "msg_456",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Truncated" }],
        model: "claude-sonnet-4-20250514",
        stop_reason: "max_tokens",
        usage: { input_tokens: 10, output_tokens: 100 },
      },
      "claude/sonnet",
    );
    expect(result.choices[0].finish_reason).toBe("length");
  });
});

describe("makeOpenaiStreamChunk", () => {
  it("creates a valid stream chunk", () => {
    const chunk = makeOpenaiStreamChunk("id-1", "claude/opus", {
      content: "Hello",
    });
    expect(chunk.object).toBe("chat.completion.chunk");
    expect(chunk.choices[0].delta.content).toBe("Hello");
    expect(chunk.choices[0].finish_reason).toBeNull();
  });

  it("creates a chunk with finish reason", () => {
    const chunk = makeOpenaiStreamChunk("id-1", "claude/opus", {}, "stop");
    expect(chunk.choices[0].finish_reason).toBe("stop");
  });
});
