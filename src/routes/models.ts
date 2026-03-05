import { Router } from "express";
import type { ProviderRegistry } from "../providers/registry.js";

export function modelsRouter(registry: ProviderRegistry): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const models = await registry.listAllModels();
      res.json({ object: "list", data: models });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
