"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, ArrowRight, Download, RotateCcw, Sparkles, Info, AlertTriangle } from "lucide-react";
import type { ImportedRecord, ImportSummary, ExtractionMode } from "@shared/crm";
import { Uploader } from "@/components/Uploader";
import { PreviewTable } from "@/components/PreviewTable";
import { ResultsTable } from "@/components/ResultsTable";
import { StatsBar } from "@/components/StatsBar";
import { ProgressBar } from "@/components/ProgressBar";
import { Stepper, type StepId } from "@/components/Stepper";
import { ThemeToggle } from "@/components/ThemeToggle";
import { streamImport } from "@/lib/api";
import { toCrmCsv, downloadText, type ParsedCsv } from "@/lib/csv";
import { cn } from "@/lib/cn";

export default function Home() {
  const [step, setStep] = useState<StepId>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);

  const [importing, setImporting] = useState(false);
  const [records, setRecords] = useState<ImportedRecord[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [mode, setMode] = useState<ExtractionMode>("ai");
  const [error, setError] = useState<string | null>(null);

  const onParsed = useCallback((p: ParsedCsv) => {
    setParsed(p);
    setRecords([]);
    setSummary(null);
    setError(null);
    setStep("preview");
  }, []);

  const reset = useCallback(() => {
    setParsed(null);
    setRecords([]);
    setSummary(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
    setStep("upload");
  }, []);

  const runImport = useCallback(async () => {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    setRecords([]);
    setSummary(null);
    setProgress({ done: 0, total: 0 });
    setStep("result");

    try {
      for await (const ev of streamImport(parsed.rows, parsed.filename)) {
        switch (ev.type) {
          case "start":
            setProgress({ done: 0, total: ev.totalBatches });
            setMode(ev.mode);
            break;
          case "batch":
            setRecords((prev) => [...prev, ...ev.records]);
            setProgress((p) => ({ ...p, done: p.done + 1 }));
            break;
          case "summary":
            setSummary(ev.summary);
            setMode(ev.mode);
            break;
          case "error":
            setError(ev.message);
            break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [parsed]);

  const onDownload = useCallback(() => {
    if (!records.length) return;
    downloadText("groweasy-crm-import.csv", toCrmCsv(records));
  }, [records]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">GrowEasy CSV Importer</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI-powered CRM lead extraction from any CSV</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <Stepper current={step} />
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 — Upload */}
        {step === "upload" && (
          <section className="animate-fade-in space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Upload a CSV file</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Any format works. We&apos;ll map the columns to the GrowEasy CRM schema with AI — after you confirm.
              </p>
            </div>
            <Uploader onParsed={onParsed} />
          </section>
        )}

        {/* Step 2 — Preview */}
        {step === "preview" && parsed && (
          <section className="animate-fade-in space-y-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Preview your data</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This is your raw CSV — no AI has run yet. Review it, then confirm to extract CRM records.
              </p>
            </div>

            <PreviewTable parsed={parsed} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" /> Choose another file
              </button>
              <button
                type="button"
                onClick={runImport}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                Confirm & Extract with AI <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 3 — Result */}
        {step === "result" && (
          <section className="animate-fade-in space-y-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Imported CRM records</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {importing ? "Extracting records in batches…" : "AI mapping complete."}
              </p>
            </div>

            {mode === "mock" && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Running in <strong>mock (heuristic) mode</strong> — no API key configured. Field mapping uses a
                  deterministic column matcher instead of the LLM. Set <code>NVIDIA_API_KEY</code> for full AI extraction.
                </span>
              </div>
            )}

            {(importing || progress.total > 0) && !summary && (
              <ProgressBar done={progress.done} total={progress.total} label="Extracting batches" />
            )}

            {summary && <StatsBar summary={summary} mode={mode} />}

            {records.length > 0 ? (
              <ResultsTable records={records} />
            ) : (
              importing && <TableSkeleton />
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4" /> Import another file
              </button>
              <button
                type="button"
                onClick={onDownload}
                disabled={!summary || (summary?.imported ?? 0) === 0}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition",
                  !summary || summary.imported === 0
                    ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                    : "bg-brand-500 text-white hover:bg-brand-600",
                )}
              >
                <Download className="h-4 w-4" /> Download CRM CSV
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400 sm:px-6">
        GrowEasy CSV Importer · Next.js + Express + NVIDIA NIM
      </footer>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative h-8 overflow-hidden rounded bg-slate-100 shimmer dark:bg-slate-800" />
      ))}
    </div>
  );
}
