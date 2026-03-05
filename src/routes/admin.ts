import { Router } from "express";
import type { KeyStore } from "../db/keys.js";
import type { UsageLogger } from "../db/usage.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export function adminRouter(
  keyStore: KeyStore,
  usageLogger?: UsageLogger,
): Router {
  const router = Router();

  // Only admin can access these routes
  router.use((req, res, next) => {
    if (!(req as AuthenticatedRequest).isAdmin) {
      res.status(403).json({
        error: {
          message: "Admin access required",
          type: "permission_error",
          code: "forbidden",
        },
      });
      return;
    }
    next();
  });

  router.post("/keys", (req, res) => {
    const { name, rate_limit } = req.body;
    if (!name || typeof name !== "string" || name.length > 255) {
      res.status(400).json({
        error: {
          message: "name is required and must be a string (max 255 chars)",
        },
      });
      return;
    }
    if (
      rate_limit !== undefined &&
      (typeof rate_limit !== "number" ||
        !Number.isInteger(rate_limit) ||
        rate_limit <= 0 ||
        rate_limit > 100000)
    ) {
      res.status(400).json({
        error: {
          message:
            "rate_limit must be a positive integer up to 100000 (requests/min)",
        },
      });
      return;
    }
    const { key, record } = keyStore.create(name, rate_limit);
    // Return key only on creation — it can never be retrieved again
    res.status(201).json({ key, ...record });
  });

  router.get("/keys", (_req, res) => {
    res.json({ data: keyStore.list() });
  });

  router.delete("/keys/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res
        .status(400)
        .json({ error: { message: "Invalid key ID" } });
      return;
    }
    const revoked = keyStore.revoke(id);
    if (!revoked) {
      res.status(404).json({ error: { message: "Key not found" } });
      return;
    }
    res.json({ message: "Key revoked" });
  });

  router.get("/usage", (req, res) => {
    if (!usageLogger) {
      res.json({ data: [] });
      return;
    }

    const keyIdParam = req.query.key_id;
    const filter = keyIdParam
      ? { keyId: parseInt(keyIdParam as string, 10) }
      : undefined;

    const stats = usageLogger.getStats(filter);
    res.json({ data: stats });
  });

  router.delete("/usage", (req, res) => {
    if (!usageLogger) {
      res.json({ message: "No usage data", deleted: 0 });
      return;
    }

    const olderThanDays = parseInt(
      (req.query.older_than_days as string) ?? "30",
      10,
    );
    const deleted = usageLogger.purge(olderThanDays);
    res.json({ message: `Purged ${deleted} records`, deleted });
  });

  return router;
}
