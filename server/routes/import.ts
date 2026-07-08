/**
 * Import API.
 *
 *   GET  /api/health  -> liveness + current extraction mode
 *   POST /api/import  -> stream extracted CRM records as NDJSON
 *
 * NDJSON (one JSON object per line) lets the browser render results and progress
 * incrementally as each batch completes, instead of blocking on the whole file.
 */

import { Router, type Request, type Response } from "express";
import { getConfig } from "../config";
import { extractStream } from "../services/extractor";
import type { ImportRequest, StreamEvent } from "../../shared/crm";

export const importRouter = Router();

importRouter.get("/health", (_req, res) => {
  const config = getConfig();
  res.json({
    status: "ok",
    mode: config.useMock ? "mock" : "ai",
    model: config.useMock ? null : config.model,
    batchSize: config.batchSize,
  });
});

function isValidRows(body: unknown): body is ImportRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as ImportRequest).rows)
  );
}

importRouter.post("/import", async (req: Request, res: Response) => {
  if (!isValidRows(req.body)) {
    res.status(400).json({ error: "Request body must be { rows: object[] }" });
    return;
  }

  const { rows } = req.body as ImportRequest;

  if (rows.length === 0) {
    res.status(400).json({ error: "No rows to import" });
    return;
  }

  // Guardrail: keep a single request bounded.
  const MAX_ROWS = 20000;
  if (rows.length > MAX_ROWS) {
    res.status(413).json({ error: `Too many rows (max ${MAX_ROWS}). Please split the file.` });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx/Render)

  const write = (event: StreamEvent) => {
    res.write(JSON.stringify(event) + "\n");
    // Flush eagerly if the platform exposes it, so batches arrive live.
    (res as Response & { flush?: () => void }).flush?.();
  };

  try {
    const config = getConfig();
    for await (const event of extractStream(rows, config)) {
      write(event);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    console.error("[import] fatal error:", message);
    // Best-effort error frame; headers already sent so we can't change status.
    write({ type: "error", message });
  } finally {
    res.end();
  }
});
