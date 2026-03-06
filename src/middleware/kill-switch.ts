import type { Request, Response, NextFunction } from "express";
import type { GatewaySettings } from "../db/settings.js";

export function killSwitchMiddleware(settings: GatewaySettings) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!settings.isApiEnabled()) {
      res.status(503).json({
        error: {
          message:
            "API access is currently disabled. Contact the administrator.",
          type: "service_unavailable",
          code: "api_disabled",
        },
      });
      return;
    }
    next();
  };
}
