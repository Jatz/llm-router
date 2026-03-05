# API Reference

All endpoints follow the [OpenAI API specification](https://platform.openai.com/docs/api-reference).

## Authentication

Every request to `/v1/*` endpoints requires:

```
Authorization: Bearer <api-key>
```

Keys are created via the admin API. The admin key (set via `ADMIN_API_KEY` env var) has full access to all endpoints including admin routes.

## Endpoints

### GET /health

Health check endpoint. No authentication required.

**Response:**
```json
{ "status": "ok" }
```

---

### GET /v1/models

List all available models across all configured providers.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "ollama/deepseek-r1:70b",
      "object": "model",
      "created": 1700000000,
      "owned_by": "ollama"
    },
    {
      "id": "claude/opus",
      "object": "model",
      "created": 0,
      "owned_by": "anthropic"
    }
  ]
}
```

Unhealthy providers are skipped (their models won't appear) rather than failing the entire request.

---

### POST /v1/chat/completions

Create a chat completion. Supports both streaming and non-streaming modes.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model ID in `<provider>/<model>` format |
| `messages` | array | Yes | Array of message objects |
| `stream` | boolean | No | Enable SSE streaming (default: false) |
| `temperature` | number | No | Sampling temperature (0-2) |
| `top_p` | number | No | Nucleus sampling (0-1) |
| `max_tokens` | number | No | Maximum tokens to generate |
| `stop` | string/array | No | Stop sequences |
| `tools` | array | No | Tool/function definitions |

**Message Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | `system`, `user`, `assistant`, or `tool` |
| `content` | string/array | Yes | Message content |
| `name` | string | No | Name of the participant |
| `tool_call_id` | string | No | ID of the tool call being responded to |

**Non-streaming Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "ollama/deepseek-r1:70b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

**Streaming Response:**

Server-Sent Events (SSE) with `Content-Type: text/event-stream`:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"claude/opus","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"claude/opus","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1700000000,"model":"claude/opus","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

### POST /v1/admin/keys

Create a new API key. **Admin only.**

**Request Body:**
```json
{
  "name": "cursor-laptop",
  "rate_limit": 100
}
```

**Response (201):**
```json
{
  "key": "llm-a1b2c3d4e5f6...",
  "id": 1,
  "name": "cursor-laptop",
  "key_prefix": "llm-a1b2",
  "created_at": "2026-03-06 00:00:00",
  "last_used_at": null,
  "revoked": 0,
  "rate_limit": 100
}
```

The `key` value is only returned once at creation. Store it securely.

---

### GET /v1/admin/keys

List all API keys. **Admin only.** Never returns the actual key values.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "cursor-laptop",
      "key_prefix": "llm-a1b2",
      "created_at": "2026-03-06 00:00:00",
      "last_used_at": "2026-03-06 01:00:00",
      "revoked": 0,
      "rate_limit": 100
    }
  ]
}
```

---

### DELETE /v1/admin/keys/:id

Revoke an API key. **Admin only.**

**Response:**
```json
{ "message": "Key revoked" }
```

---

## Error Responses

All errors follow the OpenAI error format:

```json
{
  "error": {
    "message": "Description of what went wrong",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

| HTTP Status | Type | Code | Description |
|-------------|------|------|-------------|
| 400 | `invalid_request_error` | `invalid_request` | Malformed request body |
| 401 | `authentication_error` | `invalid_api_key` | Missing or invalid API key |
| 403 | `permission_error` | `forbidden` | Admin access required |
| 404 | `invalid_request_error` | `model_not_found` | Unknown model/provider |
| 500 | `server_error` | `internal_error` | Unexpected server error |
