"use client";

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";

export interface Column {
  key: string;
  label: string;
  width?: number;
}

interface VirtualTableProps<T> {
  columns: Column[];
  rows: T[];
  cell: (row: T, columnKey: string) => ReactNode;
  rowKey: (row: T, index: number) => string | number;
  rowClassName?: (row: T) => string;
  /** Show a leading 1-based row-number column. */
  showIndex?: boolean;
  /** Tailwind height class for the scroll viewport. */
  heightClass?: string;
  emptyLabel?: string;
}

const DEFAULT_WIDTH = 180;
const INDEX_WIDTH = 56;
const ROW_HEIGHT = 44;

/**
 * A virtualized, horizontally-scrollable table with a sticky header.
 * Only the visible rows are rendered, so 50k-row CSVs stay smooth.
 */
export function VirtualTable<T>({
  columns,
  rows,
  cell,
  rowKey,
  rowClassName,
  showIndex = false,
  heightClass = "h-[60vh]",
  emptyLabel = "No rows",
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const leadWidth = showIndex ? INDEX_WIDTH : 0;
  const bodyWidth = columns.reduce((sum, c) => sum + (c.width ?? DEFAULT_WIDTH), 0);
  const totalWidth = leadWidth + bodyWidth;

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "scroll-area relative w-full overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        heightClass,
      )}
    >
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-100/95 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95"
          style={{ width: totalWidth, minWidth: "100%" }}
        >
          {showIndex && (
            <div
              className="shrink-0 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              style={{ width: INDEX_WIDTH }}
            >
              #
            </div>
          )}
          {columns.map((col) => (
            <div
              key={col.key}
              className="shrink-0 truncate px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              style={{ width: col.width ?? DEFAULT_WIDTH }}
              title={col.label}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Virtualized body */}
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">{emptyLabel}</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: totalWidth, minWidth: "100%" }}>
            {virtualRows.map((vRow) => {
              const row = rows[vRow.index];
              return (
                <div
                  key={rowKey(row, vRow.index)}
                  className={cn(
                    "absolute left-0 flex items-stretch border-b border-slate-100 text-sm dark:border-slate-800",
                    vRow.index % 2 === 1 && "bg-slate-50/60 dark:bg-slate-800/30",
                    rowClassName?.(row),
                  )}
                  style={{
                    top: vRow.start,
                    height: ROW_HEIGHT,
                    width: totalWidth,
                    minWidth: "100%",
                  }}
                >
                  {showIndex && (
                    <div
                      className="flex shrink-0 items-center px-3 text-xs tabular-nums text-slate-400"
                      style={{ width: INDEX_WIDTH }}
                    >
                      {vRow.index + 1}
                    </div>
                  )}
                  {columns.map((col) => {
                    const content = cell(row, col.key);
                    const title = typeof content === "string" || typeof content === "number" ? String(content) : undefined;
                    return (
                      <div
                        key={col.key}
                        className="flex shrink-0 items-center overflow-hidden px-3 text-slate-700 dark:text-slate-200"
                        style={{ width: col.width ?? DEFAULT_WIDTH }}
                      >
                        <span className="truncate" title={title}>
                          {content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
