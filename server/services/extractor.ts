/**
 * Orchestrates extraction over an arbitrary CSV:
 *   rows -> batches -> (LLM with retry/backoff | heuristic fallback) -> normalize
 * and yields streaming events so the client sees incremental progress.
 *
 * Design guarantees:
 *   - Every input row produces exactly one output record (aligned by index).
 *   - A failing batch never loses rows: after MAX_RETRIES it falls back to the
 *     deterministic heuristic mapper.
 *   - MOCK mode (no key / USE_MOCK=1) routes everything through the heuristic.
 */

import type { AppConfig } from "../config";
import type { CrmRecord, ImportedRecord, StreamEvent, ExtractionMode } from "../../shared/crm";
import { backoffMs, chunk, sleep } from "../lib/batch";
import { extractBatchViaLlm, type RawLlmRecord } from "./llm";
import { heuristicMapRow, mapHeaders } from "./heuristic";
import { normalizeRecord } from "./normalize";

type Proposed = Partial<Record<keyof CrmRecord, unknown>>;

/** Map one batch through the heuristic mapper (used for mock + fallback). */
function heuristicBatch(
  batch: Record<string, unknown>[],
  startIndex: number,
  source: "heuristic",
): ImportedRecord[] {
  return batch.map((row, i) => {
    const headerMap = mapHeaders(Object.keys(row));
    const proposed = heuristicMapRow(row, headerMap);
    return normalizeRecord({ proposed, originalRow: row, rowIndex: startIndex + i, source });
  });
}

/** Align the model's records back onto the batch by row_index (with fallbacks). */
function alignLlmRecords(
  batch: Record<string, unknown>[],
  startIndex: number,
  raw: RawLlmRecord[],
): ImportedRecord[] {
  const byIndex = new Map<number, RawLlmRecord>();
  raw.forEach((r, i) => {
    const idx = typeof r.row_index === "number" ? r.row_index : i;
    if (!byIndex.has(idx)) byIndex.set(idx, r);
  });

  return batch.map((row, i) => {
    const proposed = byIndex.get(i) as Proposed | undefined;
    if (proposed) {
      return normalizeRecord({ proposed, originalRow: row, rowIndex: startIndex + i, source: "ai" });
    }
    // Model dropped this row — recover it heuristically rather than lose it.
    const headerMap = mapHeaders(Object.keys(row));
    return normalizeRecord({
      proposed: heuristicMapRow(row, headerMap),
      originalRow: row,
      rowIndex: startIndex + i,
      source: "heuristic",
    });
  });
}

/** Process one batch: LLM with retry/backoff, heuristic fallback on failure. */
async function processBatch(
  batch: Record<string, unknown>[],
  startIndex: number,
  config: AppConfig,
): Promise<ImportedRecord[]> {
  if (config.useMock) return heuristicBatch(batch, startIndex, "heuristic");

  let lastError: unknown;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const raw = await extractBatchViaLlm(batch, config);
      return alignLlmRecords(batch, startIndex, raw);
    } catch (err) {
      lastError = err;
      if (attempt < config.maxRetries) await sleep(backoffMs(attempt));
    }
  }

  console.warn(
    `[extractor] batch @${startIndex} failed after ${config.maxRetries} attempts; using heuristic fallback.`,
    lastError instanceof Error ? lastError.message : lastError,
  );
  return heuristicBatch(batch, startIndex, "heuristic");
}

/**
 * Stream extraction over all rows. Yields a `start` event, one `batch` event per
 * completed batch, and a final `summary` event.
 */
export async function* extractStream(
  rows: Record<string, unknown>[],
  config: AppConfig,
): AsyncGenerator<StreamEvent> {
  const mode: ExtractionMode = config.useMock ? "mock" : "ai";
  const batches = chunk(rows, config.batchSize);

  yield { type: "start", totalRows: rows.length, totalBatches: batches.length, mode };

  let imported = 0;
  let skipped = 0;
  let cursor = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const records = await processBatch(batch, cursor, config);
    cursor += batch.length;

    for (const r of records) {
      if (r.skipped) skipped++;
      else imported++;
    }

    yield { type: "batch", batchIndex: b, records };
  }

  yield {
    type: "summary",
    summary: { total: rows.length, imported, skipped },
    mode,
  };
}
