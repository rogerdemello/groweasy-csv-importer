"use client";

import { FileSpreadsheet } from "lucide-react";
import type { ParsedCsv } from "@/lib/csv";
import { VirtualTable, type Column } from "./VirtualTable";

interface PreviewTableProps {
  parsed: ParsedCsv;
}

/** Step 2 — raw CSV preview. No AI, no mapping: exactly what was uploaded. */
export function PreviewTable({ parsed }: PreviewTableProps) {
  const columns: Column[] = parsed.headers.map((h) => ({ key: h, label: h }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <FileSpreadsheet className="h-4 w-4 text-brand-500" />
          <span className="font-medium">{parsed.filename}</span>
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
