import { describe, it, expect } from "vitest";
import {
  normalizeRecord,
  coerceStatus,
  coerceDataSource,
  coerceDate,
  resolveDataSource,
} from "../services/normalize";

describe("enum coercion", () => {
  it("accepts exact and spaced status values, rejects unknowns", () => {
    expect(coerceStatus("SALE_DONE")).toBe("SALE_DONE");
    expect(coerceStatus("good lead follow up")).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(coerceStatus("did-not-connect")).toBe("DID_NOT_CONNECT");
    expect(coerceStatus("random text")).toBe("");
    expect(coerceStatus("")).toBe("");
  });

  it("accepts known data sources, rejects unknowns", () => {
    expect(coerceDataSource("meridian tower")).toBe("meridian_tower");
    expect(coerceDataSource("SARJAPUR_PLOTS")).toBe("sarjapur_plots");
    expect(coerceDataSource("facebook ads")).toBe("");
  });
});

describe("data_source grounding (anti-hallucination + recall)", () => {
  it("rejects a proposed source that is absent from the row", () => {
    expect(resolveDataSource("meridian_tower", "Suresh Rao token received immediate")).toBe("");
  });

  it("keeps a proposed source that is present in the row", () => {
    expect(resolveDataSource("meridian_tower", "Project: Meridian Tower, Mumbai")).toBe("meridian_tower");
  });

  it("detects a source from the row even when the model left it blank", () => {
    expect(resolveDataSource("", "Client wants a plot in Sarjapur Road")).toBe("sarjapur_plots");
  });
});

describe("date validation", () => {
  it("keeps new Date()-parseable strings, blanks the rest", () => {
    expect(coerceDate("2026-05-13 14:20:48")).toBe("2026-05-13 14:20:48");
    expect(coerceDate("2026-05-13T14:20:48Z")).toBe("2026-05-13T14:20:48Z");
    expect(coerceDate("not a date")).toBe("");
    expect(coerceDate("")).toBe("");
  });
});

describe("normalizeRecord — skip rule", () => {
  it("skips a row with neither email nor mobile", () => {
    const out = normalizeRecord({
      proposed: { name: "Ghost" },
      originalRow: { Name: "Ghost", Company: "Ghost Corp" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toMatch(/email or mobile/i);
  });

  it("keeps a row that has only an email", () => {
    const out = normalizeRecord({
      proposed: { name: "A", email: "a@b.com" },
      originalRow: { Name: "A", Email: "a@b.com" },
      rowIndex: 1,
      source: "ai",
    });
    expect(out.skipped).toBe(false);
    expect(out.record.email).toBe("a@b.com");
  });

  it("keeps a row that has only a mobile", () => {
    const out = normalizeRecord({
      proposed: { name: "B", mobile_without_country_code: "9876543210", country_code: "+91" },
      originalRow: { Name: "B", Phone: "+91 9876543210" },
      rowIndex: 2,
      source: "ai",
    });
    expect(out.skipped).toBe(false);
    expect(out.record.mobile_without_country_code).toBe("9876543210");
    expect(out.record.country_code).toBe("+91");
  });
});

describe("normalizeRecord — multiple emails", () => {
  it("keeps the first email and moves the rest to crm_note", () => {
    const out = normalizeRecord({
      proposed: { name: "Multi", email: "first@x.com" },
      originalRow: { Name: "Multi", Email: "first@x.com; second@y.com, third@z.com" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.email).toBe("first@x.com");
    expect(out.record.crm_note.toLowerCase()).toContain("second@y.com");
    expect(out.record.crm_note.toLowerCase()).toContain("third@z.com");
  });
});

describe("normalizeRecord — lead owner email is not a contact", () => {
  it("excludes the lead_owner email from contact emails and notes", () => {
    const out = normalizeRecord({
      proposed: { name: "A", email: "amit@gmail.com", lead_owner: "owner@company.com" },
      originalRow: { Name: "A", "Email ID": "amit@gmail.com", "Assigned To": "owner@company.com" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.email).toBe("amit@gmail.com");
    expect(out.record.crm_note.toLowerCase()).not.toContain("owner@company.com");
  });

  it("skips a row whose only email is the lead owner's", () => {
    const out = normalizeRecord({
      proposed: { name: "Walkin", email: "owner@company.com", lead_owner: "owner@company.com" },
      originalRow: { Name: "Walkin", "Assigned To": "owner@company.com" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.skipped).toBe(true);
  });
});

describe("normalizeRecord — multiple phones", () => {
  it("keeps the primary mobile and appends extra numbers to crm_note", () => {
    const out = normalizeRecord({
      proposed: { name: "P", mobile_without_country_code: "9876543210", country_code: "+91" },
      originalRow: { Name: "P", Phone: "+91 9876543210", "Alt Phone": "9998887776" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.mobile_without_country_code).toBe("9876543210");
    expect(out.record.crm_note.replace(/\D/g, "")).toContain("9998887776");
  });

  it("splits a country code fused onto the mobile field", () => {
    const out = normalizeRecord({
      proposed: { name: "F", mobile_without_country_code: "+91 98765 43210" },
      originalRow: { Name: "F", Phone: "+91 98765 43210" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.country_code).toBe("+91");
    expect(out.record.mobile_without_country_code).toBe("9876543210");
  });

  it("handles two numbers packed into one mobile cell without a bogus country code", () => {
    const out = normalizeRecord({
      proposed: { name: "T", mobile_without_country_code: "9876500003 / 9876500004" },
      originalRow: { Name: "T", Mobile: "9876500003 / 9876500004" },
      rowIndex: 0,
      source: "heuristic",
    });
    expect(out.record.mobile_without_country_code).toBe("9876500003");
    expect(out.record.country_code).toBe("");
    expect(out.record.crm_note.replace(/\D/g, "")).toContain("9876500004");
  });

  it("does not duplicate the primary number as an extra when it also appears with a country code", () => {
    const out = normalizeRecord({
      proposed: { name: "M", mobile_without_country_code: "501234567", country_code: "+971" },
      originalRow: { Name: "M", Phone: "+971 50 123 4567", Email: "m@x.com" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.mobile_without_country_code).toBe("501234567");
    expect(out.record.crm_note).not.toContain("971501234567");
  });

  it("does not mistake a date/time for a phone number", () => {
    const out = normalizeRecord({
      proposed: { name: "D", email: "d@x.com" },
      originalRow: { Name: "D", Email: "d@x.com", Created: "2026-05-13 14:20:48" },
      rowIndex: 0,
      source: "ai",
    });
    // The only contact is the email; the timestamp must not become a phone.
    expect(out.record.mobile_without_country_code).toBe("");
  });
});

describe("normalizeRecord — CSV safety", () => {
  it("escapes newlines so a record stays on one line", () => {
    const out = normalizeRecord({
      proposed: { name: "N", email: "n@x.com", description: "line one\nline two\r\nline three" },
      originalRow: { Name: "N", Email: "n@x.com" },
      rowIndex: 0,
      source: "ai",
    });
    expect(out.record.description).not.toMatch(/[\r\n]/);
    expect(out.record.description).toContain("\\n");
  });
});
