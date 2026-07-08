/**
 * Client-side CSV parsing (PapaParse). Runs in the browser so the preview step
 * needs no backend and no AI — exactly as the spec requires.
 */

import Papa from "papaparse";
import { CRM_FIELDS, type ImportedRecord } from "@shared/crm";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  filename: string;
}

export class CsvParseError extends Error {}

/**
 * Parse a File into headers + row objects. Uses streaming under the hood so
 * large files don't freeze the UI, and preserves original column order.
 */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      dynamicTyping: false,
      worker: false,
      step: (result) => {
        if (headers.length === 0 && result.meta.fields) {
          headers = result.meta.fields.filter((f) => f && f.length > 0);
        }
        const row = result.data as Record<string, string>;
        // Ignore fully-empty rows.
        if (row && Object.values(row).some((v) => v != null && String(v).trim() !== "")) {
          rows.push(row);
        }
      },
      complete: () => {
        if (headers.length === 0) {
          reject(new CsvParseError("Could not detect any columns. Is this a valid CSV with a header row?"));
          return;
        }
        resolve({ headers, rows, filename: file.name });
      },
      error: (err) => reject(new CsvParseError(err.message)),
    });
  });
}

/** Serialize imported (non-skipped) CRM records to a GrowEasy-format CSV string. */
export function toCrmCsv(records: ImportedRecord[]): string {
  const rows = records
    .filter((r) => !r.skipped)
    .map((r) => {
      const row: Record<string, string> = {};
      for (const field of CRM_FIELDS) row[field] = r.record[field];
      return row;
    });
  return Papa.unparse({ fields: [...CRM_FIELDS], data: rows });
}

/** Trigger a client-side download of `content` as `filename`. */
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
