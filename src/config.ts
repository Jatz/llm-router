import { z } from "zod/v4";

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  host: z.string().default("0.0.0.0"),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  adminApiKey: z.string().min(1, "ADMIN_API_KEY is required"),
  ollamaUrl: z.string().url().default("http://ollama:11434"),
  claudeProxyUrl: z
    .string()
    .url()
    .default("http://host.docker.internal:9789"),
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
