# LLM Gateway

Production-grade OpenAI-compatible API gateway that routes to multiple LLM providers from a single endpoint.

## Features

- **OpenAI-compatible API** — `/v1/chat/completions` and `/v1/models`
- **Multi-provider routing** — Ollama, Claude (via proxy), OpenRouter, MiniMax
- **Streaming support** — SSE streaming for all providers
- **API key authentication** — SHA-256 hashed keys stored in SQLite
- **Admin API** — Create, list, and revoke API keys
- **Request validation** — Schema validation with zod
- **Structured logging** — JSON logs with pino

## Quick Start

```bash
# Install dependencies
npm install

# Set required environment variable
export ADMIN_API_KEY=your-secret-admin-key

# Start in development mode
npm run dev

# Run tests
npm test
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ADMIN_API_KEY` | — | Yes | Master admin key for key management |
| `PORT` | `3000` | No | Server port |
| `HOST` | `0.0.0.0` | No | Server host |
| `LOG_LEVEL` | `info` | No | Log level (fatal/error/warn/info/debug/trace) |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | No | Ollama API URL |
| `CLAUDE_PROXY_URL` | `http://host.docker.internal:9789` | No | Claude proxy URL |
| `OPENROUTER_API_KEY` | — | No | OpenRouter API key (enables OpenRouter provider) |
| `MINIMAX_API_KEY` | — | No | MiniMax API key (enables MiniMax provider) |
| `DB_PATH` | `./data/gateway.db` | No | SQLite database path |

## API Usage

### Authentication

All `/v1/*` endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/v1/models
```

### List Models

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Chat Completion

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ollama/deepseek-r1:70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Streaming

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude/sonnet",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### Model Naming

Models use `<provider>/<model>` format:

| Provider | Example Models |
|----------|---------------|
| `ollama` | `ollama/deepseek-r1:70b`, `ollama/llama4:scout`, `ollama/qwen2.5-coder:32b-instruct-q4_K_M` |
| `claude` | `claude/opus`, `claude/sonnet`, `claude/haiku` |
| `openrouter` | `openrouter/google/gemini-2.0-flash`, `openrouter/anthropic/claude-3.5-sonnet` |

## Admin API

Create and manage API keys (requires admin key):

```bash
# Create a key
curl -X POST http://localhost:3000/v1/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "cursor-laptop"}'

# List keys
curl http://localhost:3000/v1/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Revoke a key
curl -X DELETE http://localhost:3000/v1/admin/keys/1 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

## Docker

```bash
docker compose build llm-gateway
docker compose up -d llm-gateway
```

See [docs/deployment.md](docs/deployment.md) for full deployment instructions.

## Using with Cursor

Set these in Cursor's AI settings:

- **API Base URL:** `https://llm.jaymathew.com/v1`
- **API Key:** Your generated API key
- **Model:** `ollama/deepseek-r1:70b` (or any available model)

## Development

```bash
npm run dev          # Start with hot reload
npm test             # Run tests
npm run test:watch   # Watch mode
npm run typecheck    # TypeScript check
npm run build        # Build for production
```
