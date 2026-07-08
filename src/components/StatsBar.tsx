"use client";

import { CheckCircle2, XCircle, Database, Sparkles } from "lucide-react";
import type { ImportSummary, ExtractionMode } from "@shared/crm";
import { cn } from "@/lib/cn";

interface StatsBarProps {
  summary: ImportSummary;
  mode: ExtractionMode;
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "brand" | "green" | "amber" | "slate";
}) {
  const toneClasses = {
    brand: "text-brand-600 dark:text-brand-400",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    slate: "text-slate-600 dark:text-slate-300",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("shrink-0", toneClasses)}>{icon}</div>
      <div>
        <div className={cn("text-2xl font-bold tabular-nums", toneClasses)}>{value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
    </div>
  );
}

export function StatsBar({ summary, mode }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={<Database className="h-6 w-6" />} label="Total Rows" value={summary.total} tone="slate" />
      <Stat icon={<CheckCircle2 className="h-6 w-6" />} label="Imported" value={summary.imported} tone="green" />
      <Stat icon={<XCircle className="h-6 w-6" />} label="Skipped" value={summary.skipped} tone="amber" />
      <Stat
        icon={<Sparkles className="h-6 w-6" />}
        label={mode === "ai" ? "AI Extraction" : "Heuristic (mock)"}
        value={mode === "ai" ? "AI" : "Mock"}
        tone="brand"
      />
    </div>
  );
}
