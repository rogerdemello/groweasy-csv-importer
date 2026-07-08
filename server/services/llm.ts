/**
 * Thin wrapper around any OpenAI-compatible chat endpoint (default: NVIDIA NIM).
 * Responsible for the network call and for robustly parsing the model's JSON —
 * models occasionally wrap output in prose or code fences, so we recover the
 * first valid JSON object rather than trusting a clean response.
 */

import OpenAI from "openai";
import type { AppConfig } from "../config";
import { buildMessages } from "./prompt";

let cachedClient: OpenAI | null = null;

function getClient(config: AppConfig): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      maxRetries: 0, // we implement our own retry/backoff at the batch level
    });
  }
  return cachedClient;
}

/** A raw record as returned by the model (loose — normalize.ts hardens it). */
export interface RawLlmRecord {
  row_index?: number;
  [key: string]: unknown;
}

/** Extract the first balanced JSON object from a possibly-noisy string. */
export function parseModelJson(content: string): { records: RawLlmRecord[] } {
  let text = content.trim();

  // Strip markdown code fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Find the first '{' and scan to its matching '}'.
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Unbalanced JSON in model output");

  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
  const records = (parsed as { records?: unknown }).records;
  if (!Array.isArray(records)) throw new Error("Model JSON missing `records` array");
  return { records: records as RawLlmRecord[] };
}

/**
 * Call the model for one batch of rows and return the raw records array.
 * Throws on network error, timeout, or unparseable output — the caller
 * (extractor) decides retry/fallback.
 */
export async function extractBatchViaLlm(
  rows: Record<string, unknown>[],
  config: AppConfig,
): Promise<RawLlmRecord[]> {
  const client = getClient(config);
  const messages = buildMessages(rows);

  const call = (useJsonMode: boolean) =>
    client.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      messages,
      // Guided JSON when the model supports it; the robust parser is the safety net.
      ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });

  let completion;
  try {
    completion = await call(true);
  } catch {
    // Some models/endpoints reject response_format — fall back to plain mode.
    completion = await call(false);
  }

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("Empty model response");
  return parseModelJson(content).records;
}

/** Reset the memoized client (used in tests). */
export function _resetClient(): void {
  cachedClient = null;
}
