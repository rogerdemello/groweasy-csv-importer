import { describe, it, expect } from "vitest";
import { mapHeaders, heuristicMapRow } from "../services/heuristic";
import { normalizeRecord } from "../services/normalize";

describe("mapHeaders — fuzzy column matching", () => {
  it("maps messy headers to the right CRM fields", () => {
    const map = mapHeaders(["Lead Full Name", "Work Email", "Phone", "Org", "Lead Stage", "City"]);
    expect(map.get("Lead Full Name")).toBe("name");
    expect(map.get("Work Email")).toBe("email");
    expect(map.get("Phone")).toBe("mobile_without_country_code");
    expect(map.get("Org")).toBe("company");
    expect(map.get("Lead Stage")).toBe("crm_status");
    expect(map.get("City")).toBe("city");
  });

  it("prefers the most specific header for a field", () => {
    // "Email Address" is more specific than "Email" — both should not collide badly.
    const map = mapHeaders(["Email Address", "Company Name"]);
    expect(map.get("Email Address")).toBe("email");
    expect(map.get("Company Name")).toBe("company");
  });
});

describe("heuristicMapRow — classification + leftovers", () => {
  it("classifies free-text statuses into the whitelist", () => {
    const headerMap = mapHeaders(["Status"]);
    expect(heuristicMapRow({ Status: "Not interested" }, headerMap).crm_status).toBe("BAD_LEAD");
    expect(heuristicMapRow({ Status: "Deal closed / won" }, headerMap).crm_status).toBe("SALE_DONE");
    expect(heuristicMapRow({ Status: "No answer" }, headerMap).crm_status).toBe("DID_NOT_CONNECT");
    expect(heuristicMapRow({ Status: "Interested, follow up" }, headerMap).crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
  });

  it("routes unmapped columns into crm_note", () => {
    const headerMap = mapHeaders(["Name", "Email", "Budget"]);
    const proposed = heuristicMapRow(
      { Name: "X", Email: "x@y.com", Budget: "50L" },
      headerMap,
    );
    expect(String(proposed.crm_note)).toContain("Budget: 50L");
  });
});

describe("end-to-end heuristic mapping through normalize", () => {
  it("produces a valid imported record from a messy row", () => {
    const row = {
      "Lead Full Name": "John Doe",
      "Work Email": "john@example.com",
      Phone: "+91 9876543210",
      "Lead Stage": "Interested - follow up",
      Org: "GrowEasy",
    };
    const headerMap = mapHeaders(Object.keys(row));
    const proposed = heuristicMapRow(row, headerMap);
    const out = normalizeRecord({ proposed, originalRow: row, rowIndex: 0, source: "heuristic" });

    expect(out.skipped).toBe(false);
    expect(out.record.name).toBe("John Doe");
    expect(out.record.email).toBe("john@example.com");
    expect(out.record.mobile_without_country_code).toBe("9876543210");
    expect(out.record.crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(out.record.company).toBe("GrowEasy");
  });
});
