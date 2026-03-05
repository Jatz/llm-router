import { Router } from "express";
import type Database from "better-sqlite3";

export function healthRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "degraded", reason: "database unavailable" });
    }
  });

  return router;
}
