import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";
import type { AuthenticatedRequest } from "./auth.js";

export function createRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      // Admin gets very high limit (effectively unlimited)
      if (authReq.isAdmin) return 10000;
      return authReq.apiKey?.rateLimit ?? 60; // default 60 rpm
    },
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      // Use API key ID when available, avoids IPv6 fallback issues
      return authReq.apiKey?.id?.toString() ?? "admin";
    },
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        message: "Rate limit exceeded. Try again later.",
        type: "rate_limit_error",
        code: "rate_limit_exceeded",
      },
    },
    validate: { xForwardedForHeader: false, trustProxy: false },
  } satisfies Partial<Options>);
}
