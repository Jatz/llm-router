# Deployment Guide

## Docker Compose

The gateway runs as a Docker container in the `local-ai-core` stack.

### Prerequisites

- Docker and Docker Compose installed
- The `local-ai-core` stack running (Caddy, Cloudflared, Ollama, etc.)

### Setup

1. **Add environment variables** to `/Users/jaymathew/AI/stacks/local-ai-core/.env`:

```bash
# LLM Gateway
LLM_GATEWAY_ADMIN_KEY=<generate-a-strong-key>
OPENROUTER_API_KEY=sk-or-...    # Optional
MINIMAX_API_KEY=...              # Optional
```

2. **Build and start:**

```bash
cd /Users/jaymathew/AI/stacks/local-ai-core
docker compose build llm-gateway
docker compose up -d llm-gateway
```

3. **Verify:**

```bash
curl http://localhost:8080/health -H "Host: llm.jaymathew.com"
```

### Docker Compose Service

Added to `docker-compose.yml`:

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

### Caddy Route

Added to `caddy/Caddyfile` in the map block:

```
llm.jaymathew.com    llm-gateway:3000
```

### Network Architecture

```
Internet → Cloudflare Tunnel → Caddy (edge network)
                                  ↓
                            LLM Gateway (edge + ai networks)
                              ↙     ↓        ↘
                        Ollama    Claude    OpenRouter
                     (host:11434) (host:9789) (cloud)
```

The gateway container connects to:
- **edge** network: So Caddy can reverse-proxy to it
- **ai** network: So it can reach the Ollama Docker service (if used)
- **host.docker.internal**: To reach host-level services (Ollama, Claude proxy)

## Creating API Keys

After deployment, create your first API key:

```bash
curl -X POST https://llm.jaymathew.com/v1/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "cursor-laptop"}'
```

Save the returned `key` value — it cannot be retrieved again.

## Monitoring

### Logs

```bash
docker compose logs -f llm-gateway
```

Logs are structured JSON (pino) with:
- Request method, URL, status, latency
- Model used, token counts
- Provider errors
- Request IDs for tracing

### Health Check

```bash
curl https://llm.jaymathew.com/health
```

## Updating

```bash
cd /Users/jaymathew/AI/stacks/local-ai-core
docker compose build llm-gateway
docker compose up -d llm-gateway
```

The SQLite database is persisted in a Docker volume (`llm-gateway-data`), so API keys survive container rebuilds.
