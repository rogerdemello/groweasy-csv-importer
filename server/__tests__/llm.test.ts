import { describe, it, expect } from "vitest";
import { parseModelJson } from "../services/llm";
import { chunk, backoffMs } from "../lib/batch";

describe("parseModelJson — robust recovery", () => {
  it("parses clean JSON", () => {
    const out = parseModelJson('{"records":[{"row_index":0,"name":"A"}]}');
    expect(out.records).toHaveLength(1);
    expect(out.records[0].name).toBe("A");
  });

  it("strips markdown code fences", () => {
    const out = parseModelJson('```json\n{"records":[{"row_index":0}]}\n```');
    expect(out.records).toHaveLength(1);
  });

  it("recovers JSON buried in prose", () => {
    const out = parseModelJson('Sure! Here you go:\n{"records": [{"row_index": 0, "name": "B"}]}\nHope that helps.');
    expect(out.records[0].name).toBe("B");
  });

  it("handles braces inside string values", () => {
    const out = parseModelJson('{"records":[{"crm_note":"note with } brace"}]}');
    expect(out.records[0].crm_note).toBe("note with } brace");
  });

  it("throws on missing records array", () => {
    expect(() => parseModelJson('{"foo": 1}')).toThrow();
  });

  it("throws when there is no JSON object", () => {
    expect(() => parseModelJson("no json here")).toThrow();
  });
});

describe("batch helpers", () => {
  it("chunks arrays into fixed sizes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("computes bounded exponential backoff", () => {
    expect(backoffMs(1)).toBe(400);
    expect(backoffMs(2)).toBe(800);
    expect(backoffMs(99)).toBeLessThanOrEqual(8000);
  });
});
