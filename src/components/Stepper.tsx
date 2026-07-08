"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type StepId = "upload" | "preview" | "result";

const STEPS: { id: StepId; label: string }[] = [
  { id: "upload", label: "Upload CSV" },
  { id: "preview", label: "Preview" },
  { id: "result", label: "Imported Result" },
];

export function Stepper({ current }: { current: StepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition",
                  state === "done" && "bg-brand-500 text-white",
                  state === "active" && "bg-brand-500 text-white ring-4 ring-brand-500/20",
                  state === "todo" && "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  state === "todo"
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-700 dark:text-slate-200",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1 transition",
                  i < currentIndex ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
