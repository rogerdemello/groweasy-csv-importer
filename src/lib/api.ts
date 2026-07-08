/**
 * Client for the streaming import API. Reads the NDJSON response and yields
 * typed StreamEvents as they arrive, so the UI can update progress live.
 */

import type { StreamEvent } from "@shared/crm";

export interface ImportPayloadRow {
  [key: string]: string;
}

/**
 * POST rows to /api/import and yield each StreamEvent as the server produces it.
 * Consumers drive a progress bar and incrementally fill the results table.
 */
export async function* streamImport(
  rows: ImportPayloadRow[],
  filename: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, filename }),
    signal,
  });

  if (!res.ok) {
    let message = `Import failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error("Streaming not supported by this browser");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
    }
  }

  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as StreamEvent;
}
