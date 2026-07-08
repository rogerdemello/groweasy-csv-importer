/**
 * Shared CRM contract used by BOTH the Express backend and the Next.js frontend.
 *
 * Keeping the schema, enums, field metadata, and streaming event shapes in one
 * place guarantees the two halves of the app never drift apart and gives us full
 * type-safety across the network boundary.
 */

/* -------------------------------------------------------------------------- */
/*  Enums (whitelists enforced by the assignment)                             */
/* -------------------------------------------------------------------------- */

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;
export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;
export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

/* -------------------------------------------------------------------------- */
/*  CRM record                                                                */
/* -------------------------------------------------------------------------- */

export const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const;
export type CrmField = (typeof CRM_FIELDS)[number];

/**
 * A single GrowEasy CRM record. Every field is a string; unknown values are "".
 * `crm_status` / `data_source` are constrained to their whitelist or "".
 */
export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource | "";
  possession_time: string;
  description: string;
}

/** An empty, fully-typed CRM record — the canonical starting point. */
export function emptyCrmRecord(): CrmRecord {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
  };
}

/** How a record was produced. */
export type ExtractionSource = "ai" | "heuristic";

/** A processed record as returned to the client. */
export interface ImportedRecord {
  rowIndex: number;
  record: CrmRecord;
  skipped: boolean;
  skipReason?: string;
  source: ExtractionSource;
}

export interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
}

/* -------------------------------------------------------------------------- */
/*  Field metadata — drives the extraction prompt AND the results table        */
/* -------------------------------------------------------------------------- */

export interface FieldMeta {
  key: CrmField;
  label: string;
  description: string;
}

export const CRM_FIELD_META: FieldMeta[] = [
  { key: "created_at", label: "Created At", description: "Lead creation date/time. Must be parseable by JavaScript `new Date()`." },
  { key: "name", label: "Name", description: "Full name of the lead / contact person." },
  { key: "email", label: "Email", description: "Primary email address." },
  { key: "country_code", label: "Country Code", description: "Phone dialing code, e.g. +91." },
  { key: "mobile_without_country_code", label: "Mobile", description: "Mobile number WITHOUT the country code." },
  { key: "company", label: "Company", description: "Company / organization name." },
  { key: "city", label: "City", description: "City." },
  { key: "state", label: "State", description: "State / province / region." },
  { key: "country", label: "Country", description: "Country." },
  { key: "lead_owner", label: "Lead Owner", description: "Person who owns / is assigned the lead." },
  { key: "crm_status", label: "CRM Status", description: "Lead status. One of the allowed status values or blank." },
  { key: "crm_note", label: "CRM Note", description: "Remarks, follow-up notes, extra emails/phones, or anything that does not fit another field." },
  { key: "data_source", label: "Data Source", description: "Lead source. One of the allowed sources or blank." },
  { key: "possession_time", label: "Possession Time", description: "Property possession / handover time (real estate)." },
  { key: "description", label: "Description", description: "Additional free-text description." },
];

/* -------------------------------------------------------------------------- */
/*  Streaming protocol (NDJSON) between /api/import and the client             */
/* -------------------------------------------------------------------------- */

export type ExtractionMode = "ai" | "mock";

export type StreamEvent =
  | { type: "start"; totalRows: number; totalBatches: number; mode: ExtractionMode }
  | { type: "batch"; batchIndex: number; records: ImportedRecord[] }
  | { type: "summary"; summary: ImportSummary; mode: ExtractionMode }
  | { type: "error"; message: string };

/** Request body for POST /api/import. */
export interface ImportRequest {
  rows: Record<string, unknown>[];
  filename?: string;
}
