import type { Request, Response, NextFunction } from "express";
import pino from "pino";

const logger = pino({ name: "error-handler" });

export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as unknown as { requestId?: string }).requestId;
  logger.error(
    { err, requestId, method: req.method, url: req.url },
    "unhandled error",
  );

  if (res.headersSent) return;

  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error" : err.message,
      type: "server_error",
      code: "internal_error",
    },
  });
}
