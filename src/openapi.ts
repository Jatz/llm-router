import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LLM Gateway",
      version: "0.1.0",
      description: "OpenAI-compatible API gateway for multiple LLM providers",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          tags: ["System"],
          security: [],
          responses: { "200": { description: "Service healthy" } },
        },
      },
      "/v1/models": {
        get: {
          summary: "List available models",
          tags: ["Models"],
          responses: { "200": { description: "List of models" } },
        },
      },
      "/v1/chat/completions": {
        post: {
          summary: "Create chat completion",
          tags: ["Chat"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "messages"],
                  properties: {
                    model: {
                      type: "string",
                      example: "ollama/deepseek-r1:70b",
                    },
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: {
                            type: "string",
                            enum: ["system", "user", "assistant"],
                          },
                          content: { type: "string" },
                        },
                      },
                    },
                    stream: { type: "boolean", default: false },
                    temperature: { type: "number" },
                    max_tokens: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Chat completion response" } },
        },
      },
      "/v1/admin/keys": {
        post: {
          summary: "Create API key",
          tags: ["Admin"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: { "201": { description: "Key created" } },
        },
        get: {
          summary: "List API keys",
          tags: ["Admin"],
          responses: { "200": { description: "List of keys" } },
        },
      },
      "/v1/admin/keys/{id}": {
        delete: {
          summary: "Revoke API key",
          tags: ["Admin"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { "200": { description: "Key revoked" } },
        },
      },
      "/v1/settings": {
        get: {
          summary: "View gateway settings and provider status",
          description:
            "Returns gateway configuration with masked API keys and provider health status. Admin only.",
          tags: ["Admin"],
          responses: {
            "200": {
              description: "Gateway settings with masked keys and provider status",
            },
          },
        },
      },
      "/v1/admin/usage": {
        get: {
          summary: "Get usage statistics",
          tags: ["Admin"],
          parameters: [
            {
              name: "key_id",
              in: "query",
              required: false,
              schema: { type: "integer" },
              description: "Filter by API key ID",
            },
          ],
          responses: {
            "200": { description: "Usage stats grouped by model" },
          },
        },
        delete: {
          summary: "Purge old usage records",
          tags: ["Admin"],
          parameters: [
            {
              name: "older_than_days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 30 },
              description: "Delete records older than N days",
            },
          ],
          responses: { "200": { description: "Purge result" } },
        },
      },
    },
  },
  apis: [],
});
