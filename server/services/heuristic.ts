/**
 * Deterministic, no-network fallback mapper.
 *
 * Used in two places:
 *   1. MOCK mode (USE_MOCK=1 or no API key) — so the app always runs.
 *   2. As a per-batch fallback when the LLM fails after all retries — so no row
 *      is ever silently dropped.
 *
 * It maps arbitrary column headers to CRM fields via a synonym dictionary and
 * fuzzy matching, then applies light keyword classification for the two enums.
 * The result is still passed through normalize.ts, which enforces the hard rules.
 */

import type { CrmField, CrmRecord } from "../../shared/crm";

/** Synonyms for each CRM field, most-specific first. Compared normalized. */
const SYNONYMS: Record<CrmField, string[]> = {
  created_at: ["created at", "created on", "created", "createdtime", "create date", "date created", "lead date", "date", "timestamp", "time", "datetime"],
  name: ["full name", "lead name", "contact name", "customer name", "client name", "person name", "name", "first name", "fullname", "contact"],
  email: ["email address", "email id", "e mail", "emailid", "email", "mail", "work email", "primary email"],
  country_code: ["country code", "countrycode", "dial code", "isd code", "isd", "phone code", "ccode", "std code"],
  mobile_without_country_code: ["mobile number", "phone number", "contact number", "whatsapp number", "mobile no", "mobile", "phone", "whatsapp", "cell", "telephone", "tel", "msisdn", "contact no", "number", "phone no"],
  company: ["company name", "organisation", "organization", "company", "business", "firm", "employer", "org"],
  city: ["city", "town", "location city"],
  state: ["state", "province", "region"],
  country: ["country", "nation"],
  lead_owner: ["lead owner", "assigned to", "account owner", "sales rep", "handled by", "owner", "assignee", "agent", "rep", "counsellor", "counselor"],
  crm_status: ["crm status", "lead status", "call status", "status", "stage", "disposition", "result", "outcome"],
  crm_note: ["crm note", "notes", "note", "remarks", "remark", "comments", "comment", "message", "feedback"],
  data_source: ["data source", "lead source", "utm source", "source", "campaign", "channel", "origin", "medium"],
  possession_time: ["possession time", "possession date", "possession timeline", "possession", "handover", "ready to move", "occupancy"],
  description: ["description", "details", "requirement", "requirements", "about", "summary", "additional info", "info", "desc"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Score how well a normalized header matches a synonym (0 = no match). */
function matchScore(header: string, synonym: string): number {
  if (header === synonym) return 100;
  if (header.includes(synonym)) return 60 + synonym.length; // prefer longer, more specific hits
  if (synonym.includes(header) && header.length >= 3) return 30 + header.length;
  return 0;
}

/**
 * Decide, per CSV header, which CRM field it maps to. Each CRM field can only be
 * claimed by its single best-scoring header, so "email" and "alt email" don't
 * both win the primary slot.
 */
export function mapHeaders(headers: string[]): Map<string, CrmField> {
  const best: Partial<Record<CrmField, { header: string; score: number }>> = {};

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) continue;
    let winner: { field: CrmField; score: number } | null = null;
    for (const field of Object.keys(SYNONYMS) as CrmField[]) {
      for (const syn of SYNONYMS[field]) {
        const score = matchScore(norm, syn);
        if (score > 0 && (!winner || score > winner.score)) {
          winner = { field, score };
        }
      }
    }
    if (winner) {
      const current = best[winner.field];
      if (!current || winner.score > current.score) {
        best[winner.field] = { header, score: winner.score };
      }
    }
  }

  const map = new Map<string, CrmField>();
  for (const field of Object.keys(best) as CrmField[]) {
    map.set(best[field]!.header, field);
  }
  return map;
}

/* --------------------------- enum classification -------------------------- */

function classifyStatus(value: string): string {
  const v = value.toLowerCase();
  if (/(sale|sold|won|closed won|deal done|converted|purchase|booked)/.test(v)) return "SALE_DONE";
  if (/(not interested|junk|spam|bad|invalid|lost|do not|dnc|unqualified|wrong number)/.test(v)) return "BAD_LEAD";
  if (/(no answer|did not connect|not connected|busy|unreachable|ringing|no response|call back|switched off|not reachable|nr\b)/.test(v)) return "DID_NOT_CONNECT";
  if (/(follow|interested|warm|hot|good|qualified|demo|meeting|call scheduled|new)/.test(v)) return "GOOD_LEAD_FOLLOW_UP";
  return "";
}

function classifySource(value: string): string {
  const v = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const known = ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"];
  for (const k of known) {
    if (v.includes(k)) return k;
  }
  return "";
}

/**
 * Produce a proposed CRM mapping for a single row using the header map.
 * The output is intentionally a loose Partial — normalize.ts hardens it.
 */
export function heuristicMapRow(
  row: Record<string, unknown>,
  headerMap: Map<string, CrmField>,
): Partial<Record<keyof CrmRecord, unknown>> {
  const proposed: Partial<Record<keyof CrmRecord, unknown>> = {};
  const leftovers: string[] = [];

  for (const [header, rawValue] of Object.entries(row)) {
    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();
    if (!value) continue;
    const field = headerMap.get(header);
    if (!field) {
      // Unmapped but non-empty column -> preserve as context in the note.
      leftovers.push(`${header}: ${value}`);
      continue;
    }
    if (field === "crm_status") {
      proposed.crm_status = classifyStatus(value) || value;
    } else if (field === "data_source") {
      proposed.data_source = classifySource(value) || value;
    } else if (field === "crm_note") {
      proposed.crm_note = proposed.crm_note ? `${proposed.crm_note} | ${value}` : value;
    } else {
      proposed[field] = value;
    }
  }

  if (leftovers.length) {
    const existing = proposed.crm_note ? `${proposed.crm_note} | ` : "";
    proposed.crm_note = existing + leftovers.join(" | ");
  }

  return proposed;
}
