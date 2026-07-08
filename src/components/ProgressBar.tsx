"use client";

import { Loader2 } from "lucide-react";

interface ProgressBarProps {
  done: number;
  total: number;
  label?: string;
}

/** Determinate batch-progress bar shown while the AI processes the file. */
export function ProgressBar({ done, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
          {label ?? "Processing batches"}
        </span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          {done}/{total} · {pct}%
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
