import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import type { KeyStore } from "../db/keys.js";

export interface AuthenticatedRequest extends Request {
  isAdmin?: boolean;
  apiKey?: { id: number; name: string; rateLimit?: number };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authMiddleware(keyStore: KeyStore, adminApiKey: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: {
          message: "Missing or invalid Authorization header",
          type: "authentication_error",
          code: "invalid_api_key",
        },
      });
      return;
    }

    const key = authHeader.slice(7);

    // Admin key bypasses key store (timing-safe comparison)
    if (safeEqual(key, adminApiKey)) {
      req.isAdmin = true;
      return next();
    }

    const record = keyStore.validate(key);
    if (!record) {
      res.status(401).json({
        error: {
          message: "Invalid API key",
          type: "authentication_error",
          code: "invalid_api_key",
        },
      });
      return;
    }

    req.apiKey = {
      id: record.id,
      name: record.name,
      rateLimit: record.rate_limit ?? undefined,
    };
    next();
  };
}
