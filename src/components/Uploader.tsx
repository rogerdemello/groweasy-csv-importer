"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloud, FileWarning, Loader2, Download } from "lucide-react";
import {
  parseCsvFile,
  type ParsedCsv,
  CsvParseError,
  MAX_FILE_BYTES,
  SAMPLE_TEMPLATE_CSV,
  downloadText,
} from "@/lib/csv";
import { cn } from "@/lib/cn";

interface UploaderProps {
  onParsed: (parsed: ParsedCsv) => void;
}

export function Uploader({ onParsed }: UploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setParsing(true);
      try {
        const parsed = await parseCsvFile(file);
        if (parsed.rows.length === 0) {
          setError("This CSV has headers but no data rows.");
          return;
        }
        onParsed(parsed);
      } catch (err) {
        setError(err instanceof CsvParseError ? err.message : "Failed to read the file.");
      } finally {
        setParsing(false);
      }
    },
    [onParsed],
  );

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        setError(
          code === "file-too-large"
            ? "File is larger than 5 MB. Please upload a smaller CSV."
            : "Please upload a single .csv file.",
        );
        return;
      }
      if (accepted[0]) handleFile(accepted[0]);
    },
    [handleFile],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: MAX_FILE_BYTES,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "text/plain": [".csv"],
    },
  });

  const downloadTemplate = useCallback(() => {
    downloadText("groweasy-sample-template.csv", SAMPLE_TEMPLATE_CSV);
  }, []);

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition",
          isDragActive && !isDragReject
            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
            : "border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-slate-800/60",
          isDragReject && "border-red-400 bg-red-50 dark:bg-red-500/10",
        )}
      >
        <input {...getInputProps()} aria-label="Upload CSV file" />
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-full transition",
            "bg-brand-100 text-brand-600 group-hover:scale-105 dark:bg-brand-500/15 dark:text-brand-400",
          )}
        >
          {parsing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <UploadCloud className="h-8 w-8" />
          )}
        </div>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {parsing ? "Parsing CSV…" : isDragActive ? "Drop the file here" : "Drag & drop your CSV"}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          or <span className="font-medium text-brand-600 dark:text-brand-400">browse</span> to choose a file
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Supported file: .csv (max 5&nbsp;MB)
        </p>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Any layout works — Facebook, Google Ads, Excel, real-estate CRM, sales reports…
        </p>
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4" /> Download Sample CSV Template
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
