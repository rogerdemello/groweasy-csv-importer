"use client";

import { useMemo, useState } from "react";
import { Sparkles, Wrench } from "lucide-react";
import { CRM_FIELD_META, type ImportedRecord } from "@shared/crm";
import { VirtualTable, type Column } from "./VirtualTable";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/cn";

type Filter = "all" | "imported" | "skipped";

interface ResultsTableProps {
  records: ImportedRecord[];
}

const STATUS_WIDTH = 150;
const NOTE_WIDTH = 320;

const columns: Column[] = [
  { key: "__status", label: "Status", width: STATUS_WIDTH },
  ...CRM_FIELD_META.map((f) => ({
    key: f.key,
    label: f.label,
    width: f.key === "crm_note" || f.key === "description" ? NOTE_WIDTH : undefined,
  })),
];

function StatusBadge({ record }: { record: ImportedRecord }) {
  if (record.skipped) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        title={record.skipReason}
      >
        Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      {record.source === "ai" ? <Sparkles className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
      Imported
    </span>
  );
}

export function ResultsTable({ records }: ResultsTableProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const imported = records.filter((r) => !r.skipped).length;
    return { all: records.length, imported, skipped: records.length - imported };
  }, [records]);

  const filtered = useMemo(() => {
    if (filter === "imported") return records.filter((r) => !r.skipped);
    if (filter === "skipped") return records.filter((r) => r.skipped);
    return records;
  }, [records, filter]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "imported", label: `Imported (${counts.imported})` },
    { id: "skipped", label: `Skipped (${counts.skipped})` },
  ];

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              filter === tab.id
                ? "bg-brand-500 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <VirtualTable<ImportedRecord>
        columns={columns}
        rows={filtered}
        showIndex
        heightClass="h-[58vh]"
        rowKey={(row) => row.rowIndex}
        rowClassName={(row) => (row.skipped ? "opacity-70" : "")}
        emptyLabel="No records in this view"
        cell={(row, key) => {
          if (key === "__status") {
            return (
              <span className="flex flex-col">
                <StatusBadge record={row} />
                {row.skipped && row.skipReason && (
                  <span className="mt-0.5 truncate text-[11px] text-amber-600 dark:text-amber-400" title={row.skipReason}>
                    {row.skipReason}
                  </span>
                )}
              </span>
            );
          }
          if (key === "crm_status") return <StatusPill status={row.record.crm_status} />;
          const value = row.record[key as keyof typeof row.record] ?? "";
          if (value === "") return <span className="text-slate-300 dark:text-slate-600">—</span>;
          return value;
        }}
      />
    </div>
  );
}
