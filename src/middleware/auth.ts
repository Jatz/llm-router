import type { Request, Response, NextFunction } from "express";
import type { KeyStore } from "../db/keys.js";

export interface AuthenticatedRequest extends Request {
  isAdmin?: boolean;
  apiKey?: { id: number; name: string };
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

    // Admin key bypasses key store
    if (key === adminApiKey) {
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

    req.apiKey = { id: record.id, name: record.name };
    next();
  };
}
