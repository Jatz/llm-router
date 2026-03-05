import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers["x-request-id"] as string) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
