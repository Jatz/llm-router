import { Router } from "express";
import type { ProviderRegistry } from "../providers/registry.js";
import { chatRequestSchema } from "../utils/validation.js";
import { sendSSE } from "../utils/streaming.js";
import pino from "pino";

const logger = pino({ name: "chat-route" });

export function chatRouter(registry: ProviderRegistry): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: parsed.error.message,
            type: "invalid_request_error",
            code: "invalid_request",
          },
        });
        return;
      }

      const { model, stream, ...rest } = parsed.data;
      const resolved = registry.resolve(model);
      if (!resolved) {
        res.status(404).json({
          error: {
            message: `Model "${model}" not found. Use <provider>/<model> format (e.g. ollama/deepseek-r1:70b)`,
            type: "invalid_request_error",
            code: "model_not_found",
          },
        });
        return;
      }

      const { messages, ...restParams } = rest;
      const chatReq = {
        ...restParams,
        model: resolved.modelId,
        messages: parsed.data.messages,
      };
      const start = Date.now();

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        try {
          for await (const chunk of resolved.provider.chatCompletionStream({
            ...chatReq,
            stream: true,
          })) {
            sendSSE(res, chunk);
          }
          res.write("data: [DONE]\n\n");
        } catch (err) {
          logger.error({ err, model }, "streaming error");
          // If headers already sent, we can only abort
          if (!res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ error: { message: "Stream interrupted" } })}\n\n`,
            );
          }
        } finally {
          res.end();
        }
      } else {
        const result = await resolved.provider.chatCompletion(chatReq);
        const latencyMs = Date.now() - start;
        logger.info(
          { model, latencyMs, tokens: result.usage?.total_tokens },
          "chat completion",
        );
        res.json(result);
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
