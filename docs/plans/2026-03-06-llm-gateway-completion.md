# LLM Gateway — Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining features of the LLM Gateway — usage logging, rate limiting, Swagger UI, Docker integration, and Caddy routing.

**Architecture:** Express 5 + SQLite gateway with OpenAI-compatible API. Core routing, auth, and provider adapters (Ollama, Claude, OpenRouter) are already built. This plan fills in the gaps.

**Tech Stack:** Express 5, TypeScript, better-sqlite3, pino, zod, vitest, swagger-jsdoc, swagger-ui-express, express-rate-limit

---

### Task 1: Usage Logging — UsageLogger class

**Files:**
- Create: `src/db/usage.ts`
- Test: `tests/db/usage.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/usage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../src/db/migrations.js";
import { UsageLogger } from "../src/db/usage.js";

describe("UsageLogger", () => {
  let db: Database.Database;
  let logger: UsageLogger;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    logger = new UsageLogger(db);
  });

  it("logs a usage record", () => {
    // Create a key first
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)"
    ).run("test", "hash123", "llm-1234");
    const keyId = 1;

    logger.log({
      keyId,
      model: "ollama/deepseek-r1:70b",
      provider: "ollama",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 1200,
    });

    const rows = db.prepare("SELECT * FROM usage_log WHERE key_id = ?").all(keyId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "ollama/deepseek-r1:70b",
      provider: "ollama",
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      latency_ms: 1200,
    });
  });

  it("returns usage stats grouped by model", () => {
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)"
    ).run("test", "hash123", "llm-1234");

    logger.log({ keyId: 1, model: "ollama/qwen", provider: "ollama", totalTokens: 100, latencyMs: 500 });
    logger.log({ keyId: 1, model: "ollama/qwen", provider: "ollama", totalTokens: 200, latencyMs: 600 });
    logger.log({ keyId: 1, model: "claude/opus", provider: "claude", totalTokens: 50, latencyMs: 2000 });

    const stats = logger.getStats();
    expect(stats).toHaveLength(2);
    const qwen = stats.find((s) => s.model === "ollama/qwen");
    expect(qwen?.totalRequests).toBe(2);
    expect(qwen?.totalTokens).toBe(300);
  });

  it("returns usage stats filtered by key ID", () => {
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)"
    ).run("key1", "hash1", "llm-1111");
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)"
    ).run("key2", "hash2", "llm-2222");

    logger.log({ keyId: 1, model: "ollama/qwen", provider: "ollama", totalTokens: 100, latencyMs: 500 });
    logger.log({ keyId: 2, model: "claude/opus", provider: "claude", totalTokens: 50, latencyMs: 2000 });

    const stats = logger.getStats({ keyId: 1 });
    expect(stats).toHaveLength(1);
    expect(stats[0].model).toBe("ollama/qwen");
  });

  it("purges old usage records", () => {
    db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix) VALUES (?, ?, ?)"
    ).run("test", "hash123", "llm-1234");

    logger.log({ keyId: 1, model: "ollama/qwen", provider: "ollama", totalTokens: 100, latencyMs: 500 });

    const deleted = logger.purge(0); // purge everything older than 0 days
    expect(deleted).toBe(1);

    const rows = db.prepare("SELECT * FROM usage_log").all();
    expect(rows).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jaymathew/AI/stacks/local-ai-core/llm-gateway && npx vitest run tests/db/usage.test.ts`
Expected: FAIL — module `../src/db/usage.js` does not exist

**Step 3: Write the implementation**

```typescript
// src/db/usage.ts
import type Database from "better-sqlite3";

interface UsageEntry {
  keyId: number;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

interface UsageStats {
  model: string;
  provider: string;
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export class UsageLogger {
  private insertStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO usage_log (key_id, model, provider, prompt_tokens, completion_tokens, total_tokens, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  log(entry: UsageEntry): void {
    this.insertStmt.run(
      entry.keyId,
      entry.model,
      entry.provider,
      entry.promptTokens ?? null,
      entry.completionTokens ?? null,
      entry.totalTokens ?? null,
      entry.latencyMs ?? null,
    );
  }

  getStats(filter?: { keyId?: number }): UsageStats[] {
    let sql = `
      SELECT model, provider,
        COUNT(*) as totalRequests,
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COALESCE(AVG(latency_ms), 0) as avgLatencyMs
      FROM usage_log
    `;
    const params: unknown[] = [];
    if (filter?.keyId) {
      sql += " WHERE key_id = ?";
      params.push(filter.keyId);
    }
    sql += " GROUP BY model, provider ORDER BY totalRequests DESC";
    return this.db.prepare(sql).all(...params) as UsageStats[];
  }

  purge(olderThanDays: number): number {
    const result = this.db.prepare(
      "DELETE FROM usage_log WHERE created_at < datetime('now', ?)"
    ).run(`-${olderThanDays} days`);
    return result.changes;
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/jaymathew/AI/stacks/local-ai-core/llm-gateway && npx vitest run tests/db/usage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/usage.ts tests/db/usage.test.ts
git commit -m "feat: add UsageLogger class for tracking API usage"
```

---

### Task 2: Wire usage logging into chat route

**Files:**
- Modify: `src/app.ts` — create UsageLogger, pass to chat router
- Modify: `src/routes/chat.ts` — log usage after each completion
- Modify: `tests/routes/chat.test.ts` — verify usage logging

**Step 1: Modify app.ts to create and pass UsageLogger**

In `src/app.ts`, import `UsageLogger`, instantiate it, pass to `chatRouter(registry, usageLogger)`, and return it from `createApp`.

**Step 2: Modify chat.ts to accept and use UsageLogger**

`chatRouter(registry, usageLogger?)` — after non-streaming completion, call `usageLogger.log(...)` with the request's key info, model, provider, usage, latency. For streaming, log after stream ends (token counts may not be available — log with null tokens).

**Step 3: Update tests**

Add a test in `tests/routes/chat.test.ts` that verifies usage is logged after a successful completion (using a mock provider).

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/app.ts src/routes/chat.ts tests/routes/chat.test.ts
git commit -m "feat: wire usage logging into chat completions route"
```

---

### Task 3: Usage stats admin endpoint

**Files:**
- Modify: `src/routes/admin.ts` — add GET /usage endpoint
- Test: `tests/routes/admin.test.ts` — add usage stats test

**Step 1: Add GET /usage route**

In `admin.ts`, add `GET /usage` that calls `usageLogger.getStats(filter)` where filter is optional query params `?key_id=N`. Returns `{ data: [...stats] }`.

**Step 2: Update admin router factory to accept UsageLogger**

`adminRouter(keyStore, usageLogger)` — pass from app.ts.

**Step 3: Write test**

Test that GET /v1/admin/usage returns stats (create a key, mock some usage, verify response).

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/routes/admin.ts src/app.ts tests/routes/admin.test.ts
git commit -m "feat: add usage stats admin endpoint"
```

---

### Task 4: Rate limiting middleware

**Files:**
- Create: `src/middleware/rate-limit.ts`
- Test: `tests/middleware/rate-limit.test.ts`
- Modify: `src/app.ts` — apply rate limiting

**Step 1: Write rate-limit middleware**

Per-key rate limiting using `express-rate-limit`. If a key has `rate_limit` set (requests per minute), enforce it. Admin key bypasses rate limiting.

```typescript
// src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

export function createRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: (req: Request) => {
      if ((req as any).isAdmin) return 0; // unlimited
      const keyInfo = (req as any).apiKey;
      return keyInfo?.rateLimit ?? 60; // default 60 rpm
    },
    keyGenerator: (req: Request) => {
      return (req as any).apiKey?.id?.toString() ?? req.ip ?? "unknown";
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
  });
}
```

**Step 2: Apply in app.ts after auth middleware on /v1/* routes**

**Step 3: Update KeyStore.validate() to return rate_limit field**

**Step 4: Write basic test**

**Step 5: Run tests, commit**

```bash
git add src/middleware/rate-limit.ts src/app.ts src/db/keys.ts tests/middleware/rate-limit.test.ts
git commit -m "feat: add per-key rate limiting"
```

---

### Task 5: Swagger UI + OpenAPI spec

**Files:**
- Create: `src/routes/docs.ts`
- Modify: `src/app.ts` — mount /docs route
- Modify: `tests/routes/` — add docs test

**Step 1: Create OpenAPI spec via swagger-jsdoc**

Define the spec inline in `src/routes/docs.ts` with all endpoints documented.

**Step 2: Mount swagger-ui-express at /docs**

**Step 3: Test that GET /docs returns 200**

**Step 4: Run tests, commit**

```bash
git add src/routes/docs.ts src/app.ts
git commit -m "feat: add Swagger UI at /docs"
```

---

### Task 6: Docker Compose + Caddy integration

**Files:**
- Modify: `/Users/jaymathew/AI/stacks/local-ai-core/docker-compose.yml` — add llm-gateway service
- Modify: `/Users/jaymathew/AI/stacks/local-ai-core/caddy/Caddyfile` — add llm.jaymathew.com route
- Modify: `/Users/jaymathew/AI/stacks/local-ai-core/.env` — add LLM_GATEWAY_ADMIN_KEY and OPENROUTER_API_KEY placeholders

**Step 1: Add service to docker-compose.yml**

```yaml
llm-gateway:
  build: ./llm-gateway
  container_name: llm-gateway
  restart: unless-stopped
  networks:
    - edge
    - ai
  extra_hosts:
    - "host.docker.internal:host-gateway"
  volumes:
    - llm-gateway-data:/app/data
  environment:
    ADMIN_API_KEY: ${LLM_GATEWAY_ADMIN_KEY}
    OLLAMA_URL: http://ollama:11434
    CLAUDE_PROXY_URL: http://host.docker.internal:9789
    OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
```

**Step 2: Add Caddy route**

Add `llm.jaymathew.com` → `llm-gateway:3000` to the Caddyfile map.

**Step 3: Add env var placeholders to .env**

**Step 4: Commit**

```bash
git add docker-compose.yml caddy/Caddyfile .env
git commit -m "feat: add llm-gateway to Docker Compose + Caddy routing"
```

---

### Task 7: Final verification

**Step 1: Run full test suite**

```bash
cd /Users/jaymathew/AI/stacks/local-ai-core/llm-gateway && npx vitest run
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Docker build test**

```bash
docker build -t llm-gateway .
```

**Step 4: Update README if needed**
