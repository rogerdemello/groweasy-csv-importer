/**
 * Runtime configuration, resolved once from environment variables.
 *
 * The app is deliberately provider-agnostic: it talks to any OpenAI-compatible
 * endpoint. When no API key is present (or USE_MOCK=1) it falls back to a
 * deterministic heuristic mapper so the importer always runs.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface AppConfig {
  /** When true, skip the network entirely and use the heuristic mapper. */
  useMock: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
  port: number;
}

export function getConfig(): AppConfig {
  const apiKey = (process.env.NVIDIA_API_KEY ?? "").trim();
  const forcedMock = process.env.USE_MOCK === "1";

  return {
    useMock: forcedMock || apiKey === "",
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1",
    model: process.env.LLM_MODEL?.trim() || "meta/llama-3.1-8b-instruct",
    temperature: floatEnv("LLM_TEMPERATURE", 0),
    batchSize: Math.max(1, intEnv("BATCH_SIZE", 8)),
    maxRetries: Math.max(1, intEnv("MAX_RETRIES", 3)),
    timeoutMs: Math.max(1, intEnv("REQUEST_TIMEOUT", 60)) * 1000,
    port: intEnv("PORT", 3000),
  };
}

export type ExtractionMode = "ai" | "mock";
