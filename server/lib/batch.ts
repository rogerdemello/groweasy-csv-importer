/** Small, dependency-free helpers for batching and retry backoff. */

/** Split an array into consecutive chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with a sane cap. attempt is 1-based. */
export function backoffMs(attempt: number, base = 400, cap = 8000): number {
  const ms = base * 2 ** (attempt - 1);
  return Math.min(ms, cap);
}
