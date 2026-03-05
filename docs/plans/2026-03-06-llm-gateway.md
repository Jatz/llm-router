# LLM Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-grade OpenAI-compatible API gateway that routes to Ollama, Claude proxy, OpenRouter, and MiniMax from a single endpoint.

**Architecture:** Single Express 5 service exposing `/v1/chat/completions` and `/v1/models`. Each backend has a provider adapter that translates to/from OpenAI format. API key auth via SQLite. Runs in Docker on the `edge` + `ai` networks, routed by Caddy at `llm.jaymathew.com`.

**Tech Stack:** Node.js 22, Express 5, TypeScript (strict), better-sqlite3, pino, zod, vitest, swagger-jsdoc + swagger-ui-express

---

## Infrastructure Context

| Component | Host | Port | Format |
|-----------|------|------|--------|
| Ollama | host.docker.internal | 11434 | OpenAI-compatible |
| Claude proxy | host.docker.internal | 9789 | Anthropic Messages API |
| OpenRouter | openrouter.ai | 443 | OpenAI-compatible |
| MiniMax | api.minimax.chat | 443 | OpenAI-compatible |

**Model ID convention:** `<provider>/<model-name>` — e.g. `ollama/deepseek-r1:70b`, `claude/opus`, `openrouter/google/gemini-2.0-flash`

**Docker networks:** `edge` (Caddy), `ai` (Ollama Docker service)

**Existing patterns to follow:**
- `claudeclaw/` — vitest, pino, better-sqlite3, tsc build
- `claude-code-proxy/` — Express-style HTTP, SSE streaming

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts` (placeholder)

**Step 1: Initialize package.json**

```json
{
  "name": "llm-gateway",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "engines": {
    "node": ">=22"
  }
}
```

**Step 2: Install dependencies**

```bash
cd /Users/jaymathew/AI/stacks/local-ai-core/llm-gateway
npm install express better-sqlite3 pino zod swagger-jsdoc swagger-ui-express express-rate-limit
npm install -D typescript tsx vitest @types/node @types/express @types/better-sqlite3 @types/swagger-jsdoc @types/swagger-ui-express eslint
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
.env
```

**Step 5: Create placeholder entry point**

```typescript
// src/index.ts
console.log("llm-gateway starting...");
```

**Step 6: Verify build**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold project"
```

---

## Task 2: Config + Express App + Health Endpoint

**Files:**
- Create: `src/config.ts`
- Create: `src/app.ts`
- Modify: `src/index.ts`
- Create: `src/routes/health.ts`
- Test: `tests/routes/health.test.ts`

**Step 1: Write config with zod validation**

```typescript
// src/config.ts
import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  host: z.string().default("0.0.0.0"),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  adminApiKey: z.string().min(1, "ADMIN_API_KEY is required"),
  ollamaUrl: z.string().url().default("http://host.docker.internal:11434"),
  claudeProxyUrl: z.string().url().default("http://host.docker.internal:9789"),
  openrouterApiKey: z.string().optional(),
  minimaxApiKey: z.string().optional(),
  dbPath: z.string().default("./data/gateway.db"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    host: process.env.HOST,
    logLevel: process.env.LOG_LEVEL,
    adminApiKey: process.env.ADMIN_API_KEY,
    ollamaUrl: process.env.OLLAMA_URL,
    claudeProxyUrl: process.env.CLAUDE_PROXY_URL,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    minimaxApiKey: process.env.MINIMAX_API_KEY,
    dbPath: process.env.DB_PATH,
  });
}
```

**Step 2: Write the health route test**

```typescript
// tests/routes/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";  // install supertest
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp({ /* minimal test config */ });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

**Step 3: Run test — verify it fails**

```bash
npx vitest run tests/routes/health.test.ts
```

**Step 4: Implement app.ts and health route**

```typescript
// src/app.ts
import express from "express";
import pino from "pino";
import { healthRouter } from "./routes/health.js";
import type { Config } from "./config.js";

export function createApp(config: Partial<Config> = {}) {
  const app = express();
  const logger = pino({ level: config.logLevel ?? "info" });

  app.use(express.json({ limit: "10mb" }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start });
    });
    next();
  });

  app.use("/health", healthRouter);

  return app;
}
```

```typescript
// src/routes/health.ts
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});
```

```typescript
// src/index.ts
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import pino from "pino";

const config = loadConfig();
const logger = pino({ level: config.logLevel });
const app = createApp(config);

app.listen(config.port, config.host, () => {
  logger.info(`LLM Gateway listening on ${config.host}:${config.port}`);
});
```

**Step 5: Run test — verify it passes**

```bash
npx vitest run tests/routes/health.test.ts
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: express app with health endpoint and config"
```

---

## Task 3: Provider Adapter Interface + Registry

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/registry.ts`
- Test: `tests/providers/registry.test.ts`

**Step 1: Define the provider adapter interface**

```typescript
// src/providers/types.ts
export interface OpenAIModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: { name: string; description?: string; parameters?: Record<string, unknown> };
  }>;
  stop?: string | string[];
}

export interface OpenAIChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChatChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ProviderAdapter {
  readonly name: string;
  listModels(): Promise<OpenAIModel[]>;
  chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse>;
  chatCompletionStream(req: OpenAIChatRequest): AsyncIterable<OpenAIChatChunk>;
  healthCheck(): Promise<boolean>;
}
```

**Step 2: Write registry test**

```typescript
// tests/providers/registry.test.ts
import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../src/providers/registry.js";

describe("ProviderRegistry", () => {
  it("routes model ID to correct provider", () => {
    const registry = new ProviderRegistry();
    const mockProvider = { name: "ollama" } as any;
    registry.register("ollama", mockProvider);

    const result = registry.resolve("ollama/deepseek-r1:70b");
    expect(result?.provider.name).toBe("ollama");
    expect(result?.modelId).toBe("deepseek-r1:70b");
  });

  it("returns null for unknown provider prefix", () => {
    const registry = new ProviderRegistry();
    expect(registry.resolve("unknown/model")).toBeNull();
  });

  it("lists all models from all providers", async () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      name: "test",
      listModels: async () => [{ id: "test/model1", object: "model", created: 0, owned_by: "test" }],
      healthCheck: async () => true,
    } as any;
    registry.register("test", mockProvider);

    const models = await registry.listAllModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("test/model1");
  });
});
```

**Step 3: Run test — verify it fails**

**Step 4: Implement registry**

```typescript
// src/providers/registry.ts
import type { ProviderAdapter, OpenAIModel } from "./types.js";
import pino from "pino";

const logger = pino({ name: "provider-registry" });

export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();

  register(prefix: string, provider: ProviderAdapter): void {
    this.providers.set(prefix, provider);
    logger.info({ prefix, provider: provider.name }, "registered provider");
  }

  resolve(modelId: string): { provider: ProviderAdapter; modelId: string } | null {
    const slashIndex = modelId.indexOf("/");
    if (slashIndex === -1) return null;

    const prefix = modelId.substring(0, slashIndex);
    const provider = this.providers.get(prefix);
    if (!provider) return null;

    return { provider, modelId: modelId.substring(slashIndex + 1) };
  }

  async listAllModels(): Promise<OpenAIModel[]> {
    const results: OpenAIModel[] = [];
    for (const [prefix, provider] of this.providers) {
      try {
        const healthy = await provider.healthCheck();
        if (!healthy) {
          logger.warn({ prefix }, "provider unhealthy, skipping model listing");
          continue;
        }
        const models = await provider.listModels();
        results.push(...models);
      } catch (err) {
        logger.error({ prefix, err }, "failed to list models");
      }
    }
    return results;
  }

  getProviders(): Map<string, ProviderAdapter> {
    return this.providers;
  }
}
```

**Step 5: Run test — verify it passes**

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: provider adapter interface and registry"
```

---

## Task 4: Ollama Adapter

**Files:**
- Create: `src/providers/ollama.ts`
- Test: `tests/providers/ollama.test.ts`

**Step 1: Write Ollama adapter test**

```typescript
// tests/providers/ollama.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaAdapter } from "../src/providers/ollama.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OllamaAdapter", () => {
  const adapter = new OllamaAdapter("http://localhost:11434");

  beforeEach(() => { mockFetch.mockReset(); });

  it("lists models with ollama/ prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: "deepseek-r1:70b", size: 42500000000, modified_at: "2025-01-01T00:00:00Z" },
          { name: "llama4:scout", size: 67400000000, modified_at: "2025-01-02T00:00:00Z" },
        ],
      }),
    });

    const models = await adapter.listModels();
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("ollama/deepseek-r1:70b");
    expect(models[0].owned_by).toBe("ollama");
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/tags", expect.any(Object));
  });

  it("forwards chat completion as OpenAI format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1700000000,
        model: "deepseek-r1:70b",
        choices: [{ index: 0, message: { role: "assistant", content: "Hello!" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const result = await adapter.chatCompletion({
      model: "deepseek-r1:70b",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.choices[0].message.content).toBe("Hello!");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("health check returns true when Ollama is reachable", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await adapter.healthCheck()).toBe(true);
  });

  it("health check returns false when Ollama is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await adapter.healthCheck()).toBe(false);
  });
});
```

**Step 2: Run test — verify it fails**

**Step 3: Implement Ollama adapter**

```typescript
// src/providers/ollama.ts
import type { ProviderAdapter, OpenAIModel, OpenAIChatRequest, OpenAIChatResponse, OpenAIChatChunk } from "./types.js";
import pino from "pino";

const logger = pino({ name: "ollama-adapter" });

export class OllamaAdapter implements ProviderAdapter {
  readonly name = "ollama";

  constructor(private baseUrl: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
    const data = await res.json() as { models: Array<{ name: string; modified_at: string }> };
    return data.models.map((m) => ({
      id: `ollama/${m.name}`,
      object: "model" as const,
      created: Math.floor(new Date(m.modified_at).getTime() / 1000),
      owned_by: "ollama",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama chat completion failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async *chatCompletionStream(req: OpenAIChatRequest): AsyncIterable<OpenAIChatChunk> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama streaming failed (${res.status}): ${body}`);
    }
    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            yield JSON.parse(data) as OpenAIChatChunk;
          } catch {
            logger.warn({ data }, "failed to parse SSE chunk");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

**Step 4: Run test — verify it passes**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Ollama provider adapter"
```

---

## Task 5: Claude Proxy Adapter (OpenAI ↔ Anthropic Translation)

**Files:**
- Create: `src/providers/claude.ts`
- Create: `src/utils/anthropic-translator.ts`
- Test: `tests/providers/claude.test.ts`
- Test: `tests/utils/anthropic-translator.test.ts`

This is the most complex adapter. The Claude proxy at port 9789 accepts Anthropic Messages API format:
- `POST /v1/messages` with `{ messages, system, model, stream }`
- Returns Anthropic SSE events: `message_start`, `content_block_start`, `content_block_delta`, `message_stop`

**Step 1: Write translator tests**

```typescript
// tests/utils/anthropic-translator.test.ts
import { describe, it, expect } from "vitest";
import { openaiToAnthropic, anthropicToOpenai, anthropicStreamToOpenaiChunks } from "../src/utils/anthropic-translator.js";

describe("openaiToAnthropic", () => {
  it("extracts system message and converts messages", () => {
    const result = openaiToAnthropic({
      model: "claude/opus",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ],
    });
    expect(result.system).toBe("You are helpful");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("user");
    expect(result.model).toBe("opus");
  });

  it("handles no system message", () => {
    const result = openaiToAnthropic({
      model: "claude/sonnet",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.system).toBeUndefined();
    expect(result.messages).toHaveLength(1);
  });

  it("maps max_tokens", () => {
    const result = openaiToAnthropic({
      model: "claude/opus",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 1000,
    });
    expect(result.max_tokens).toBe(1000);
  });
});

describe("anthropicToOpenai", () => {
  it("converts Anthropic response to OpenAI format", () => {
    const result = anthropicToOpenai({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-opus-4-20250514",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    }, "claude/opus");
    expect(result.object).toBe("chat.completion");
    expect(result.choices[0].message.content).toBe("Hello!");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage?.prompt_tokens).toBe(10);
  });
});
```

**Step 2: Run test — verify it fails**

**Step 3: Implement translator**

```typescript
// src/utils/anthropic-translator.ts
import type { OpenAIChatRequest, OpenAIChatResponse, OpenAIChatChunk } from "../providers/types.js";
import { randomUUID } from "node:crypto";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
  usage: { input_tokens: number; output_tokens: number };
}

export function openaiToAnthropic(req: OpenAIChatRequest): AnthropicRequest {
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];

  for (const msg of req.messages) {
    if (msg.role === "system") {
      system = typeof msg.content === "string" ? msg.content : msg.content.map(c => c.text ?? "").join("");
    } else if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content as string });
    }
  }

  // Strip provider prefix from model ID (e.g. "claude/opus" → "opus")
  const model = req.model.includes("/") ? req.model.split("/").slice(1).join("/") : req.model;

  const result: AnthropicRequest = { model, messages };
  if (system) result.system = system;
  if (req.max_tokens) result.max_tokens = req.max_tokens;
  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;
  if (req.stop) result.stop_sequences = Array.isArray(req.stop) ? req.stop : [req.stop];

  return result;
}

const STOP_REASON_MAP: Record<string, "stop" | "length"> = {
  end_turn: "stop",
  max_tokens: "length",
  stop_sequence: "stop",
};

export function anthropicToOpenai(anthropicRes: AnthropicResponse, originalModel: string): OpenAIChatResponse {
  const content = anthropicRes.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  return {
    id: `chatcmpl-${anthropicRes.id}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: originalModel,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: STOP_REASON_MAP[anthropicRes.stop_reason ?? ""] ?? "stop",
    }],
    usage: {
      prompt_tokens: anthropicRes.usage.input_tokens,
      completion_tokens: anthropicRes.usage.output_tokens,
      total_tokens: anthropicRes.usage.input_tokens + anthropicRes.usage.output_tokens,
    },
  };
}

export function makeOpenaiStreamChunk(
  id: string,
  model: string,
  delta: { role?: "assistant"; content?: string },
  finishReason: "stop" | "length" | null = null,
): OpenAIChatChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}
```

**Step 4: Write Claude adapter test**

```typescript
// tests/providers/claude.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeAdapter } from "../src/providers/claude.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ClaudeAdapter", () => {
  const adapter = new ClaudeAdapter("http://localhost:9789");

  beforeEach(() => { mockFetch.mockReset(); });

  it("lists three Claude models", async () => {
    const models = await adapter.listModels();
    expect(models).toHaveLength(3);
    expect(models.map(m => m.id)).toEqual(["claude/opus", "claude/sonnet", "claude/haiku"]);
  });

  it("translates OpenAI request to Anthropic format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello from Claude!" }],
        model: "claude-opus-4-20250514",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const result = await adapter.chatCompletion({
      model: "opus",
      messages: [
        { role: "system", content: "Be helpful" },
        { role: "user", content: "Hello" },
      ],
      max_tokens: 1000,
    });

    expect(result.choices[0].message.content).toBe("Hello from Claude!");
    expect(result.choices[0].finish_reason).toBe("stop");

    // Verify the fetch call was made with Anthropic format
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe("http://localhost:9789/v1/messages");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.system).toBe("Be helpful");
    expect(body.model).toBe("opus");
    expect(body.messages[0].role).toBe("user");
  });

  it("health check pings /health", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) });
    expect(await adapter.healthCheck()).toBe(true);
  });
});
```

**Step 5: Implement Claude adapter**

```typescript
// src/providers/claude.ts
import type { ProviderAdapter, OpenAIModel, OpenAIChatRequest, OpenAIChatResponse, OpenAIChatChunk } from "./types.js";
import { openaiToAnthropic, anthropicToOpenai, makeOpenaiStreamChunk } from "../utils/anthropic-translator.js";
import pino from "pino";

const logger = pino({ name: "claude-adapter" });

const CLAUDE_MODELS = ["opus", "sonnet", "haiku"];

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = "claude";

  constructor(private proxyUrl: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    return CLAUDE_MODELS.map((model) => ({
      id: `claude/${model}`,
      object: "model" as const,
      created: 0,
      owned_by: "anthropic",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const anthropicReq = openaiToAnthropic(req);
    anthropicReq.stream = false;
    if (!anthropicReq.max_tokens) anthropicReq.max_tokens = 4096;

    const res = await fetch(`${this.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anthropicReq),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude proxy returned ${res.status}: ${body}`);
    }

    const anthropicRes = await res.json();
    return anthropicToOpenai(anthropicRes, `claude/${req.model}`);
  }

  async *chatCompletionStream(req: OpenAIChatRequest): AsyncIterable<OpenAIChatChunk> {
    const anthropicReq = openaiToAnthropic(req);
    anthropicReq.stream = true;
    if (!anthropicReq.max_tokens) anthropicReq.max_tokens = 4096;

    const res = await fetch(`${this.proxyUrl}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anthropicReq),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude proxy streaming returned ${res.status}: ${body}`);
    }
    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const chatId = `chatcmpl-${Date.now()}`;
    const model = `claude/${req.model}`;
    let sentRole = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const event = JSON.parse(data);

            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              if (!sentRole) {
                yield makeOpenaiStreamChunk(chatId, model, { role: "assistant", content: "" });
                sentRole = true;
              }
              yield makeOpenaiStreamChunk(chatId, model, { content: event.delta.text });
            } else if (event.type === "message_stop") {
              yield makeOpenaiStreamChunk(chatId, model, {}, "stop");
            }
          } catch {
            logger.warn({ data }, "failed to parse Claude SSE event");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.proxyUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

**Step 6: Run tests — verify they pass**

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: Claude proxy adapter with OpenAI<->Anthropic translation"
```

---

## Task 6: OpenRouter Adapter

**Files:**
- Create: `src/providers/openrouter.ts`
- Test: `tests/providers/openrouter.test.ts`

**Step 1: Write OpenRouter adapter test**

```typescript
// tests/providers/openrouter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenRouterAdapter } from "../src/providers/openrouter.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OpenRouterAdapter", () => {
  const adapter = new OpenRouterAdapter("sk-or-test-key");

  beforeEach(() => { mockFetch.mockReset(); });

  it("lists models with openrouter/ prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", created: 1700000000 },
          { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", created: 1700000000 },
        ],
      }),
    });

    const models = await adapter.listModels();
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("openrouter/google/gemini-2.0-flash");
  });

  it("forwards chat completion with API key", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "chatcmpl-123",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
      }),
    });

    await adapter.chatCompletion({
      model: "google/gemini-2.0-flash",
      messages: [{ role: "user", content: "Hello" }],
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(opts.headers["Authorization"]).toBe("Bearer sk-or-test-key");
  });
});
```

**Step 2: Implement OpenRouter adapter (pass-through with API key injection)**

```typescript
// src/providers/openrouter.ts
import type { ProviderAdapter, OpenAIModel, OpenAIChatRequest, OpenAIChatResponse, OpenAIChatChunk } from "./types.js";
import pino from "pino";

const logger = pino({ name: "openrouter-adapter" });
const BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = "openrouter";

  constructor(private apiKey: string) {}

  async listModels(): Promise<OpenAIModel[]> {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenRouter /models returned ${res.status}`);
    const data = await res.json() as { data: Array<{ id: string; created: number }> };
    return data.data.map((m) => ({
      id: `openrouter/${m.id}`,
      object: "model" as const,
      created: m.created ?? 0,
      owned_by: "openrouter",
    }));
  }

  async chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter chat completion failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<OpenAIChatResponse>;
  }

  async *chatCompletionStream(req: OpenAIChatRequest): AsyncIterable<OpenAIChatChunk> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter streaming failed (${res.status}): ${body}`);
    }
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try { yield JSON.parse(data) as OpenAIChatChunk; } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

**Step 3: Run tests — verify they pass**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: OpenRouter provider adapter"
```

---

## Task 7: GET /v1/models + POST /v1/chat/completions Endpoints

**Files:**
- Create: `src/routes/models.ts`
- Create: `src/routes/chat.ts`
- Create: `src/utils/streaming.ts`
- Modify: `src/app.ts`
- Test: `tests/routes/models.test.ts`
- Test: `tests/routes/chat.test.ts`

**Step 1: Write models route test**

```typescript
// tests/routes/models.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers.js";

describe("GET /v1/models", () => {
  it("returns models from all providers", async () => {
    const app = createTestApp();
    const res = await request(app).get("/v1/models").set("Authorization", "Bearer test-key");
    expect(res.status).toBe(200);
    expect(res.body.object).toBe("list");
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
```

**Step 2: Write chat route test**

```typescript
// tests/routes/chat.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers.js";

describe("POST /v1/chat/completions", () => {
  it("rejects request without model", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-key")
      .send({ messages: [{ role: "user", content: "Hi" }] });
    expect(res.status).toBe(400);
  });

  it("rejects unknown provider prefix", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-key")
      .send({ model: "unknown/model", messages: [{ role: "user", content: "Hi" }] });
    expect(res.status).toBe(404);
  });
});
```

**Step 3: Create test helpers**

```typescript
// tests/routes/helpers.ts
import { createApp } from "../src/app.js";

export function createTestApp() {
  return createApp({
    adminApiKey: "test-admin-key",
    dbPath: ":memory:",
    logLevel: "silent",
  });
}
```

**Step 4: Implement routes**

```typescript
// src/routes/models.ts
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
```

```typescript
// src/routes/chat.ts
import { Router } from "express";
import type { ProviderRegistry } from "../providers/registry.js";
import { chatRequestSchema } from "../utils/validation.js";
import { sendSSE } from "../utils/streaming.js";
import pino from "pino";

const logger = pino({ name: "chat-route" });

export function chatRouter(registry: ProviderRegistry): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: parsed.error.message, type: "invalid_request_error", code: "invalid_request" },
        });
      }

      const { model, stream, ...rest } = parsed.data;
      const resolved = registry.resolve(model);
      if (!resolved) {
        return res.status(404).json({
          error: { message: `Model "${model}" not found`, type: "invalid_request_error", code: "model_not_found" },
        });
      }

      const chatReq = { model: resolved.modelId, messages: parsed.data.messages, ...rest };

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for await (const chunk of resolved.provider.chatCompletionStream({ ...chatReq, stream: true })) {
          sendSSE(res, chunk);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        const result = await resolved.provider.chatCompletion(chatReq);
        res.json(result);
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

```typescript
// src/utils/streaming.ts
import type { Response } from "express";

export function sendSSE(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

```typescript
// src/utils/validation.ts
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
});

export const chatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(messageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.any()).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});
```

**Step 5: Update app.ts to wire routes with registry**

Update `createApp` to accept a `ProviderRegistry` and wire up `/v1/models`, `/v1/chat/completions`.

**Step 6: Run tests — verify they pass**

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: /v1/models and /v1/chat/completions endpoints"
```

---

## Task 8: SQLite Database + API Key Auth

**Files:**
- Create: `src/db/index.ts`
- Create: `src/db/migrations.ts`
- Create: `src/db/keys.ts`
- Create: `src/middleware/auth.ts`
- Create: `src/routes/admin.ts`
- Test: `tests/db/keys.test.ts`
- Test: `tests/middleware/auth.test.ts`

**Step 1: Implement database layer**

```typescript
// src/db/index.ts
import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
```

```typescript
// src/db/migrations.ts
import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      rate_limit INTEGER
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL REFERENCES api_keys(id),
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      latency_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_usage_key_id ON usage_log(key_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
  `);
}
```

```typescript
// src/db/keys.ts
import type Database from "better-sqlite3";
import { randomBytes, createHash } from "node:crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: number;
  rate_limit: number | null;
}

export class KeyStore {
  constructor(private db: Database.Database) {}

  create(name: string, rateLimit?: number): { key: string; record: ApiKeyRecord } {
    const key = `llm-${randomBytes(24).toString("hex")}`;
    const keyHash = hashKey(key);
    const keyPrefix = key.slice(0, 8);

    const stmt = this.db.prepare(
      "INSERT INTO api_keys (name, key_hash, key_prefix, rate_limit) VALUES (?, ?, ?, ?)"
    );
    const result = stmt.run(name, keyHash, keyPrefix, rateLimit ?? null);

    const record = this.db.prepare("SELECT * FROM api_keys WHERE id = ?").get(result.lastInsertRowid) as ApiKeyRecord;
    return { key, record };
  }

  validate(key: string): ApiKeyRecord | null {
    const keyHash = hashKey(key);
    const record = this.db.prepare(
      "SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0"
    ).get(keyHash) as ApiKeyRecord | undefined;

    if (record) {
      this.db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(record.id);
    }

    return record ?? null;
  }

  list(): ApiKeyRecord[] {
    return this.db.prepare("SELECT * FROM api_keys ORDER BY created_at DESC").all() as ApiKeyRecord[];
  }

  revoke(id: number): boolean {
    const result = this.db.prepare("UPDATE api_keys SET revoked = 1 WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
```

**Step 2: Implement auth middleware**

```typescript
// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import type { KeyStore } from "../db/keys.js";

export function authMiddleware(keyStore: KeyStore, adminApiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: { message: "Missing or invalid Authorization header", type: "authentication_error", code: "invalid_api_key" },
      });
    }

    const key = authHeader.slice(7);

    // Admin key bypasses key store
    if (key === adminApiKey) {
      (req as any).isAdmin = true;
      return next();
    }

    const record = keyStore.validate(key);
    if (!record) {
      return res.status(401).json({
        error: { message: "Invalid API key", type: "authentication_error", code: "invalid_api_key" },
      });
    }

    (req as any).apiKey = record;
    next();
  };
}
```

**Step 3: Implement admin routes**

```typescript
// src/routes/admin.ts
import { Router } from "express";
import type { KeyStore } from "../db/keys.js";

export function adminRouter(keyStore: KeyStore): Router {
  const router = Router();

  // Only admin can access these routes
  router.use((req, res, next) => {
    if (!(req as any).isAdmin) {
      return res.status(403).json({ error: { message: "Admin access required", type: "permission_error" } });
    }
    next();
  });

  router.post("/keys", (req, res) => {
    const { name, rate_limit } = req.body;
    if (!name) return res.status(400).json({ error: { message: "name is required" } });
    const { key, record } = keyStore.create(name, rate_limit);
    res.status(201).json({ key, ...record });
  });

  router.get("/keys", (_req, res) => {
    res.json({ data: keyStore.list() });
  });

  router.delete("/keys/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: "Invalid key ID" } });
    const revoked = keyStore.revoke(id);
    if (!revoked) return res.status(404).json({ error: { message: "Key not found" } });
    res.json({ message: "Key revoked" });
  });

  return router;
}
```

**Step 4: Write tests for key store and auth**

**Step 5: Run tests — verify they pass**

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: SQLite database, API key auth, admin endpoints"
```

---

## Task 9: Error Handling + Logging + Request IDs

**Files:**
- Create: `src/middleware/error-handler.ts`
- Create: `src/middleware/request-id.ts`
- Modify: `src/app.ts`

**Step 1: Implement global error handler**

```typescript
// src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from "express";
import pino from "pino";

const logger = pino({ name: "error-handler" });

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId;
  logger.error({ err, requestId, method: req.method, url: req.url }, "unhandled error");

  if (res.headersSent) return;

  const status = (err as any).statusCode ?? 500;
  res.status(status).json({
    error: {
      message: status === 500 ? "Internal server error" : err.message,
      type: "server_error",
      code: "internal_error",
    },
  });
}
```

```typescript
// src/middleware/request-id.ts
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
```

**Step 2: Wire into app.ts**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: error handling, request IDs, structured logging"
```

---

## Task 10: OpenAPI Spec + Swagger UI

**Files:**
- Modify: `src/app.ts`
- Create: `src/openapi.ts`

**Step 1: Add Swagger UI at /docs**

Configure swagger-jsdoc to scan route files for JSDoc comments, serve Swagger UI at `/docs`.

**Step 2: Add JSDoc annotations to routes**

Add `@openapi` tags to each route handler for auto-generated API docs.

**Step 3: Verify /docs loads in browser**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: OpenAPI spec and Swagger UI at /docs"
```

---

## Task 11: Dockerfile + Docker Compose Integration

**Files:**
- Create: `Dockerfile`
- Modify: `/Users/jaymathew/AI/stacks/local-ai-core/docker-compose.yml` (add llm-gateway service)
- Modify: `/Users/jaymathew/AI/stacks/local-ai-core/caddy/Caddyfile` (add route)

**Step 1: Create multi-stage Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
RUN mkdir -p /app/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

**Step 2: Add to docker-compose.yml**

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
    - ADMIN_API_KEY=${LLM_GATEWAY_ADMIN_KEY}
    - CLAUDE_PROXY_URL=http://host.docker.internal:9789
    - OLLAMA_URL=http://host.docker.internal:11434
    - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    - MINIMAX_API_KEY=${MINIMAX_API_KEY}
```

Add `llm-gateway-data:` to the volumes section.

**Step 3: Add Caddy route**

Add to Caddyfile map block:
```
llm.jaymathew.com    llm-gateway:3000
```

**Step 4: Build and test**

```bash
cd /Users/jaymathew/AI/stacks/local-ai-core
docker compose build llm-gateway
docker compose up -d llm-gateway
curl http://localhost:8080/health -H "Host: llm.jaymathew.com"
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Dockerfile and Docker Compose integration"
```

---

## Task 12: Documentation

**Files:**
- Create: `README.md`
- Create: `docs/api.md`
- Create: `docs/providers.md`
- Create: `docs/deployment.md`

**README.md** — Quick start, features, setup, env vars, Docker usage.

**docs/api.md** — Full API reference: every endpoint, request/response examples, error codes, streaming format.

**docs/providers.md** — How each provider works, model naming, configuration, quirks.

**docs/deployment.md** — Docker setup, Caddy config, Cloudflare tunnel, API key creation, monitoring.

**Step 1: Write all docs**

**Step 2: Commit**

```bash
git add -A && git commit -m "docs: comprehensive API, provider, and deployment documentation"
```

---

## Task 13: End-to-End Smoke Test

**Files:**
- Create: `tests/e2e/smoke.test.ts`

**Step 1: Write E2E tests**

Test against running gateway instance:
- Health check returns 200
- `/v1/models` returns models
- `/v1/chat/completions` with Ollama model returns response
- `/v1/chat/completions` with streaming returns SSE chunks
- Auth rejects invalid keys
- Admin can create/list/revoke keys

**Step 2: Run against local instance**

```bash
ADMIN_API_KEY=test npm run dev &
npx vitest run tests/e2e/
```

**Step 3: Commit**

```bash
git add -A && git commit -m "test: end-to-end smoke tests"
```

---

## Execution Order

Tasks 1-2 are sequential (scaffold → app). Tasks 3-6 can run in parallel (independent adapters). Tasks 7-9 are sequential (routes need adapters, auth needs DB). Tasks 10-12 can run in parallel. Task 13 is last.

```
[1] → [2] → [3,4,5,6] → [7] → [8] → [9] → [10,11,12] → [13]
```
