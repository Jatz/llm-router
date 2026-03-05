# Provider Configuration

The gateway routes requests to backend providers based on the model ID prefix.

## Ollama

**Prefix:** `ollama/`
**Format:** Pass-through (Ollama natively speaks OpenAI format)
**URL config:** `OLLAMA_URL` (default: `http://host.docker.internal:11434`)

**Available models:**

| Model ID | Description |
|----------|-------------|
| `ollama/deepseek-r1:70b` | DeepSeek R1 70B reasoning model |
| `ollama/llama4:scout` | Llama 4 Scout |
| `ollama/qwen3.5:122b` | Qwen 3.5 122B |
| `ollama/qwen2.5-coder:32b-instruct-q4_K_M` | Qwen 2.5 Coder 32B |
| `ollama/gpt-oss:120b` | GPT-OSS 120B |
| `ollama/gpt-oss:20b` | GPT-OSS 20B |
| `ollama/glm-4.7-flash:latest` | GLM 4.7 Flash |
| `ollama/llama3.2:3b` | Llama 3.2 3B |
| `ollama/llama3.2:1b` | Llama 3.2 1B |

Models are discovered dynamically via Ollama's `/api/tags` endpoint. Any model you pull with `ollama pull` will automatically appear.

**How it works:** Requests are forwarded to Ollama's built-in OpenAI-compatible endpoint at `/v1/chat/completions`. No format translation is needed.

---

## Claude (via Proxy)

**Prefix:** `claude/`
**Format:** Translates OpenAI ↔ Anthropic Messages API
**URL config:** `CLAUDE_PROXY_URL` (default: `http://host.docker.internal:9789`)

**Available models:**

| Model ID | Underlying Model |
|----------|-----------------|
| `claude/opus` | Claude Opus 4 |
| `claude/sonnet` | Claude Sonnet 4 |
| `claude/haiku` | Claude Haiku |

**How it works:** The gateway translates incoming OpenAI-format requests to Anthropic Messages API format, sends them to the Claude proxy, then translates the response back to OpenAI format.

Key translation details:
- `messages[role="system"]` → Anthropic `system` parameter
- `stream: true` → Anthropic SSE → OpenAI SSE chunk format
- `stop` → `stop_sequences`
- `finish_reason: "stop"` ← `stop_reason: "end_turn"`
- `finish_reason: "length"` ← `stop_reason: "max_tokens"`
- Default `max_tokens: 4096` if not specified

**Note:** The Claude proxy spawns the `claude` CLI binary. Response times may be longer than direct API calls.

---

## OpenRouter

**Prefix:** `openrouter/`
**Format:** Pass-through (OpenRouter speaks OpenAI format)
**API key config:** `OPENROUTER_API_KEY`

**Example models:**

| Model ID | Description |
|----------|-------------|
| `openrouter/google/gemini-2.0-flash` | Google Gemini 2.0 Flash |
| `openrouter/anthropic/claude-3.5-sonnet` | Claude 3.5 Sonnet |
| `openrouter/meta-llama/llama-3.1-70b-instruct` | Llama 3.1 70B |

Models are discovered via OpenRouter's `/api/v1/models` endpoint. The full OpenRouter model catalog is available.

**How it works:** Requests are forwarded to `https://openrouter.ai/api/v1/chat/completions` with the OpenRouter API key injected. No format translation needed.

**To enable:** Set the `OPENROUTER_API_KEY` environment variable. If not set, the OpenRouter provider is not registered.

---

## Adding a New Provider

1. Create a new adapter in `src/providers/` implementing the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  readonly name: string;
  listModels(): Promise<OpenAIModel[]>;
  chatCompletion(req: OpenAIChatRequest): Promise<OpenAIChatResponse>;
  chatCompletionStream(req: OpenAIChatRequest): AsyncIterable<OpenAIChatChunk>;
  healthCheck(): Promise<boolean>;
}
```

2. Register it in `src/app.ts`:

```typescript
registry.register("myprovider", new MyProviderAdapter(config.myProviderUrl));
```

3. Users can now use `myprovider/<model-name>` in their requests.
