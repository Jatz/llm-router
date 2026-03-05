import { describe, it, expect, vi, beforeEach } from "vitest";
import { MiniMaxAdapter } from "../../src/providers/minimax.js";

const TEST_API_KEY = "test-minimax-key";

describe("MiniMaxAdapter", () => {
  let adapter: MiniMaxAdapter;

  beforeEach(() => {
    adapter = new MiniMaxAdapter(TEST_API_KEY);
    vi.restoreAllMocks();
  });

  it("has name 'minimax'", () => {
    expect(adapter.name).toBe("minimax");
  });

  describe("listModels", () => {
    it("returns static list of MiniMax models", async () => {
      const models = await adapter.listModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: "minimax/MiniMax-M1",
        object: "model",
        created: 0,
        owned_by: "minimax",
      });
      expect(models[1]).toEqual({
        id: "minimax/MiniMax-M1-40k",
        object: "model",
        created: 0,
        owned_by: "minimax",
      });
    });
  });

  describe("chatCompletion", () => {
    it("sends request to MiniMax API with auth header", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "MiniMax-M1",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await adapter.chatCompletion({
        model: "MiniMax-M1",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        "https://api.minimax.chat/v1/text/chatcompletion_v2",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }),
      );

      // Verify stream is set to false
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.stream).toBe(false);
    });

    it("throws on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      await expect(
        adapter.chatCompletion({
          model: "MiniMax-M1",
          messages: [{ role: "user", content: "Hi" }],
        }),
      ).rejects.toThrow("MiniMax chat completion failed (401)");
    });
  });

  describe("chatCompletionStream", () => {
    it("parses SSE stream chunks", async () => {
      const chunk1 = {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "MiniMax-M1",
        choices: [
          { index: 0, delta: { role: "assistant", content: "Hel" }, finish_reason: null },
        ],
      };
      const chunk2 = {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "MiniMax-M1",
        choices: [
          { index: 0, delta: { content: "lo!" }, finish_reason: "stop" },
        ],
      };

      const sseData = [
        `data: ${JSON.stringify(chunk1)}`,
        `data: ${JSON.stringify(chunk2)}`,
        `data: [DONE]`,
        "",
      ].join("\n");

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );

      const chunks: unknown[] = [];
      for await (const chunk of adapter.chatCompletionStream({
        model: "MiniMax-M1",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual(chunk1);
      expect(chunks[1]).toEqual(chunk2);
    });

    it("throws on non-OK streaming response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Server Error", { status: 500 }),
      );

      await expect(async () => {
        for await (const _ of adapter.chatCompletionStream({
          model: "MiniMax-M1",
          messages: [{ role: "user", content: "Hi" }],
        })) {
          // consume
        }
      }).rejects.toThrow("MiniMax streaming failed (500)");
    });
  });

  describe("healthCheck", () => {
    it("returns true when API key is configured", async () => {
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
    });

    it("returns false when API key is empty", async () => {
      const emptyAdapter = new MiniMaxAdapter("");
      const healthy = await emptyAdapter.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
