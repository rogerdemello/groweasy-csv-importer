"use client";

import { FileSpreadsheet } from "lucide-react";
import { formatBytes, type ParsedCsv } from "@/lib/csv";
import { VirtualTable, type Column } from "./VirtualTable";

interface PreviewTableProps {
  parsed: ParsedCsv;
}

/** Step 2 — raw CSV preview. No AI, no mapping: exactly what was uploaded. */
export function PreviewTable({ parsed }: PreviewTableProps) {
  const columns: Column[] = parsed.headers.map((h) => ({ key: h, label: h }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{parsed.filename}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(parsed.size)}</div>
          </div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{parsed.rows.length.toLocaleString()}</span> rows ·{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{parsed.headers.length}</span> columns
        </div>
      </div>

      <VirtualTable<Record<string, string>>
        columns={columns}
        rows={parsed.rows}
        showIndex
        rowKey={(_row, i) => i}
        cell={(row, key) => row[key] ?? ""}
        emptyLabel="No data rows"
      />
    </div>
  );
}
