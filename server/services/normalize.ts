/**
 * Deterministic post-processing that GUARANTEES the assignment rules hold,
 * independent of what the LLM (or heuristic mapper) proposed. This is what makes
 * the extraction trustworthy: the model does the intelligent field mapping, and
 * this layer enforces the hard invariants.
 *
 * Enforced here:
 *   - crm_status / data_source coerced to their whitelist (or blank).
 *   - created_at kept only if `new Date()` can parse it.
 *   - Multiple emails  -> first kept, the rest appended to crm_note.
 *   - Multiple mobiles  -> first kept, the rest appended to crm_note.
 *   - All fields collapsed to a single CSV-safe line (newlines escaped as \n).
 *   - Rows with neither email nor mobile are skipped.
 */

import {
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  emptyCrmRecord,
  type CrmRecord,
  type CrmStatus,
  type DataSource,
  type ExtractionSource,
  type ImportedRecord,
} from "../../shared/crm";

/* --------------------------- primitive helpers ---------------------------- */

/** Coerce any value to a trimmed string ("" for null/undefined/objects). */
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Collapse newlines so a record always stays on a single CSV row. */
function csvSafe(v: string): string {
  return v.replace(/\r\n|\r|\n/g, "\\n").replace(/\s{2,}/g, " ").trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Matches both year-first (2026-05-13) and day/month-first (13-05-2026) dates.
const DATE_TOKEN_RE = /\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/g;
const TIME_TOKEN_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
// A phone candidate: an optional +, then digits interspersed with separators.
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;

function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  return dedupe(found.map((e) => e.toLowerCase()));
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}


interface Phone {
  /** Original-ish rendering (keeps a leading + if present). */
  display: string;
  /** Digits only. */
  digits: string;
  /** Last 10 digits — used to treat +91XXXX and XXXX as the same number. */
  sig: string;
}

function toPhone(candidate: string): Phone | null {
  const hadPlus = candidate.trim().startsWith("+");
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const sig = digits.slice(-10);
  return { display: (hadPlus ? "+" : "") + digits, digits, sig };
}

/**
 * Collect phone numbers across the row's values, guarding against dates/times/
 * emails. Values are split on obvious multi-entry delimiters (commas, slashes,
 * pipes, runs of 2+ spaces) so two numbers in one cell don't merge into one
 * oversized (and therefore discarded) match.
 */
function collectPhones(values: string[]): Phone[] {
  const phones: Phone[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const parts = value.split(/[,;/|]|\s{2,}/);
    for (const part of parts) {
      const cleaned = part
        .replace(EMAIL_RE, " ")
        .replace(DATE_TOKEN_RE, " ")
        .replace(TIME_TOKEN_RE, " ");
      const candidates = cleaned.match(PHONE_RE) ?? [];
      for (const c of candidates) {
        const p = toPhone(c);
        if (p && !seen.has(p.sig)) {
          seen.add(p.sig);
          phones.push(p);
        }
      }
    }
  }
  return phones;
}

/* --------------------------- enum coercion -------------------------------- */

export function coerceStatus(v: unknown): CrmStatus | "" {
  const u = str(v).toUpperCase().replace(/[\s-]+/g, "_");
  return (CRM_STATUS_VALUES as readonly string[]).includes(u) ? (u as CrmStatus) : "";
}

export function coerceDataSource(v: unknown): DataSource | "" {
  const l = str(v).toLowerCase().replace(/[\s-]+/g, "_");
  return (DATA_SOURCE_VALUES as readonly string[]).includes(l) ? (l as DataSource) : "";
}

/** Distinctive tokens that must appear in the row for a data_source to be trusted. */
const DATA_SOURCE_KEYWORDS: Record<DataSource, string[]> = {
  leads_on_demand: ["leads on demand", "leadsondemand", "leads_on_demand"],
  meridian_tower: ["meridian"],
  eden_park: ["eden park", "eden"],
  varah_swamy: ["varah"],
  sarjapur_plots: ["sarjapur"],
};

/**
 * Grounded data_source resolution. LLMs sometimes hallucinate a plausible project
 * name that isn't in the row, so we only accept a source whose keyword actually
 * appears in the original row. This also *improves recall*: if the model left it
 * blank but a whitelisted project name is present in the row, we detect it.
 */
export function resolveDataSource(proposed: unknown, rowText: string): DataSource | "" {
  const norm = rowText.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const coerced = coerceDataSource(proposed);
  if (coerced && DATA_SOURCE_KEYWORDS[coerced].some((k) => norm.includes(k))) {
    return coerced;
  }
  for (const src of DATA_SOURCE_VALUES) {
    if (DATA_SOURCE_KEYWORDS[src].some((k) => norm.includes(k))) return src;
  }
  return "";
}

export function coerceDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : s;
}

function normalizeCountryCode(v: unknown): string {
  const digits = str(v).replace(/[^\d]/g, "");
  return digits ? "+" + digits : "";
}

/**
 * Resolve a single parsed phone into {country_code, mobile}, splitting a fused
 * country code even when the model/heuristic left it attached (e.g. a Phone of
 * "+91 9876543210" or "919876543210"). Uses the separately-provided country code
 * as a hint when available.
 */
function resolvePhone(phone: Phone, providedCountryCode: string): { cc: string; mobile: string } {
  const digits = phone.digits;
  const ccDigits = providedCountryCode.replace(/\D/g, "");

  if (ccDigits && digits.startsWith(ccDigits) && digits.length - ccDigits.length >= 6) {
    // Number carries the same country code that was provided separately.
    return { cc: "+" + ccDigits, mobile: digits.slice(ccDigits.length) };
  }
  if (ccDigits && digits.length > 10) {
    // Provided country code differs from any embedded one; keep the local part.
    return { cc: "+" + ccDigits, mobile: digits.slice(-10) };
  }
  if (!ccDigits && digits.length > 10) {
    // No country code given, but the number is longer than a local number.
    return { cc: "+" + digits.slice(0, digits.length - 10), mobile: digits.slice(-10) };
  }
  return { cc: ccDigits ? "+" + ccDigits : "", mobile: digits };
}

/* --------------------------- note merging --------------------------------- */

function mergeNote(base: string, extraEmails: string[], extraPhones: string[]): string {
  const parts: string[] = [];
  const baseLower = base.toLowerCase();
  if (base) parts.push(base);

  const newEmails = extraEmails.filter((e) => !baseLower.includes(e.toLowerCase()));
  if (newEmails.length) parts.push(`Additional emails: ${newEmails.join(", ")}`);

  const newPhones = extraPhones.filter((p) => !base.replace(/\D/g, "").includes(p.replace(/\D/g, "")));
  if (newPhones.length) parts.push(`Additional phone numbers: ${newPhones.join(", ")}`);

  return parts.join(" | ");
}

/* --------------------------- main entry ----------------------------------- */

export interface NormalizeInput {
  proposed: Partial<Record<keyof CrmRecord, unknown>>;
  originalRow: Record<string, unknown>;
  rowIndex: number;
  source: ExtractionSource;
}

/**
 * Turn a proposed mapping + the original row into a fully-validated
 * ImportedRecord, enforcing every hard rule.
 */
export function normalizeRecord({ proposed, originalRow, rowIndex, source }: NormalizeInput): ImportedRecord {
  const rec = emptyCrmRecord();

  // 1. Copy straightforward string fields from the proposal.
  rec.name = str(proposed.name);
  rec.company = str(proposed.company);
  rec.city = str(proposed.city);
  rec.state = str(proposed.state);
  rec.country = str(proposed.country);
  rec.lead_owner = str(proposed.lead_owner);
  rec.possession_time = str(proposed.possession_time);
  rec.description = str(proposed.description);

  // 2. Enums + date (hard-validated). data_source is grounded against the row
  //    below (once we have the row text) to prevent LLM hallucination.
  rec.crm_status = coerceStatus(proposed.crm_status);
  rec.created_at = coerceDate(proposed.created_at);

  const values = Object.values(originalRow).map(str);
  rec.data_source = resolveDataSource(proposed.data_source, values.join(" "));

  // 3. Emails: scan the whole row so alternate-email columns are captured, but
  //    exclude the lead_owner's own address so it isn't mistaken for a contact
  //    email (and a row whose only email IS the owner's is correctly skipped).
  const ownerEmails = new Set(extractEmails(str(proposed.lead_owner)));
  const notOwner = (e: string) => !ownerEmails.has(e);
  const proposedEmails = extractEmails(str(proposed.email)).filter(notOwner);
  const rowEmails = extractEmails(values.join(" ")).filter(notOwner);
  const orderedEmails = dedupe([...proposedEmails, ...rowEmails]);
  rec.email = orderedEmails[0] ?? "";
  const extraEmails = orderedEmails.slice(1);

  // 4. Phones: prefer the model's mobile (parsed through the extractor to handle
  //    a fused country code or multiple numbers in one cell); collect alternate
  //    numbers from the rest of the row. Dates/times are guarded out upstream.
  const rowPhones = collectPhones(values);
  const proposedPhones = collectPhones([str(proposed.mobile_without_country_code)]);
  const primaryPhone = proposedPhones[0] ?? rowPhones[0] ?? null;

  if (primaryPhone) {
    const { cc, mobile } = resolvePhone(primaryPhone, str(proposed.country_code));
    rec.country_code = cc;
    rec.mobile_without_country_code = mobile;
  } else {
    rec.country_code = normalizeCountryCode(proposed.country_code);
  }

  // Extras = other numbers in the row. Beyond the last-10-digit signature, also
  // treat a candidate as the same number if it is the primary with a country
  // code prepended (or vice-versa) — otherwise "+9198..." and "98..." duplicate.
  const primarySig = primaryPhone?.sig ?? "";
  const primaryDigits = rec.mobile_without_country_code;
  const isSameAsPrimary = (p: Phone) =>
    p.sig === primarySig ||
    (primaryDigits.length >= 6 && (p.digits.endsWith(primaryDigits) || primaryDigits.endsWith(p.digits)));
  const extraPhones = rowPhones.filter((p) => !isSameAsPrimary(p)).map((p) => p.display);

  // 5. Notes: model's note + any extra contacts.
  rec.crm_note = mergeNote(str(proposed.crm_note), extraEmails, extraPhones);

  // 6. CSV-safety pass on every field.
  for (const key of Object.keys(rec) as (keyof CrmRecord)[]) {
    rec[key] = csvSafe(rec[key]) as never;
  }

  // 7. Skip rule: neither email nor mobile => not importable.
  const hasContact = rec.email !== "" || rec.mobile_without_country_code !== "";
  if (!hasContact) {
    return {
      rowIndex,
      record: rec,
      skipped: true,
      skipReason: "No email or mobile number",
      source,
    };
  }

  return { rowIndex, record: rec, skipped: false, source };
}
