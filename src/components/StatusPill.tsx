"use client";

import type { CrmStatus } from "@shared/crm";
import { cn } from "@/lib/cn";

/** Friendly, GrowEasy-style labels + colors for each CRM status. */
const STATUS_MAP: Record<CrmStatus, { label: string; cls: string }> = {
  SALE_DONE: {
    label: "Sale Done",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  GOOD_LEAD_FOLLOW_UP: {
    label: "Good Lead",
    cls: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  },
  DID_NOT_CONNECT: {
    label: "Did Not Connect",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300",
  },
  BAD_LEAD: {
    label: "Bad Lead",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

export function StatusPill({ status }: { status: CrmStatus | "" }) {
  if (!status) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const { label, cls } = STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}
