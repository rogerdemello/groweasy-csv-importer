/**
 * Prompt engineering for CRM field extraction.
 *
 * The system prompt is the heart of the app: it teaches the model the GrowEasy
 * schema, the two enum whitelists, and every extraction rule, then constrains it
 * to a strict JSON envelope keyed by `row_index` so we can realign the output
 * even if the model reorders or drops rows.
 */

import { CRM_FIELD_META, CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "../../shared/crm";

const FIELD_DOC = CRM_FIELD_META.map((f) => `  - ${f.key}: ${f.description}`).join("\n");

export const SYSTEM_PROMPT = `You are GrowEasy's CRM Import Engine. You convert rows from ANY CSV format
(Facebook/Google Ads exports, Excel sheets, real-estate CRM dumps, sales reports,
messy hand-made spreadsheets) into GrowEasy's fixed CRM schema.

Your ONLY job is intelligent field mapping. Column names, order, and language vary
wildly between sources — infer the meaning of each column from its header AND its
values, then map it to the correct CRM field.

## Target CRM fields
${FIELD_DOC}

## Allowed crm_status values (use EXACTLY one, else "")
${CRM_STATUS_VALUES.map((v) => `  - ${v}`).join("\n")}
Map free-text statuses by meaning, e.g. "Won"/"Deal closed" -> SALE_DONE,
"Not interested"/"Junk" -> BAD_LEAD, "No answer"/"Busy"/"Ringing" -> DID_NOT_CONNECT,
"Interested"/"Warm"/"Follow up" -> GOOD_LEAD_FOLLOW_UP. If unsure, use "".

## Allowed data_source values (use EXACTLY one, else "")
${DATA_SOURCE_VALUES.map((v) => `  - ${v}`).join("\n")}
Only set data_source when a value CONFIDENTLY matches one of these. Otherwise "".

## Rules
1. created_at MUST be a string parseable by JavaScript \`new Date()\` (e.g.
   "2026-05-13 14:20:48" or ISO-8601). If you cannot form a valid date, use "".
2. Split phone numbers into country_code (e.g. "+91") and
   mobile_without_country_code (digits only, no country code).
3. crm_note is the catch-all for remarks, follow-up notes, extra comments, extra
   email addresses, and extra phone numbers.
4. If a row has MULTIPLE emails: put the first in "email" and append the rest to
   crm_note. If a row has MULTIPLE phone numbers: keep the first as the mobile and
   append the rest to crm_note.
5. Keep every record on a SINGLE line. Never emit real newlines inside a value —
   if needed, write the two characters backslash-n (\\n) instead.
6. Leave any field you cannot determine as an empty string "". Never invent data.
7. SKIP a row (set "skipped": true with a short "skip_reason") if it has NEITHER
   an email NOR any phone/mobile number.

## Output format
Return ONLY a JSON object, no prose, no markdown fences:
{
  "records": [
    {
      "row_index": <number, echo the row_index from the input>,
      "created_at": "", "name": "", "email": "", "country_code": "",
      "mobile_without_country_code": "", "company": "", "city": "", "state": "",
      "country": "", "lead_owner": "", "crm_status": "", "crm_note": "",
      "data_source": "", "possession_time": "", "description": "",
      "skipped": false, "skip_reason": ""
    }
  ]
}
Return exactly one object per input row, preserving row_index.`;

const FEW_SHOT_INPUT = {
  rows: [
    {
      row_index: 0,
      "Lead Full Name": "John Doe",
      "Work Email": "john.doe@example.com; jdoe@work.com",
      Phone: "+91 98765 43210",
      Org: "GrowEasy",
      "Lead Stage": "Interested - follow up next week",
      City: "Mumbai",
    },
    {
      row_index: 1,
      Name: "No Contact Person",
      Company: "Ghost Corp",
      City: "Nowhere",
    },
  ],
};

const FEW_SHOT_OUTPUT = {
  records: [
    {
      row_index: 0,
      created_at: "",
      name: "John Doe",
      email: "john.doe@example.com",
      country_code: "+91",
      mobile_without_country_code: "9876543210",
      company: "GrowEasy",
      city: "Mumbai",
      state: "",
      country: "",
      lead_owner: "",
      crm_status: "GOOD_LEAD_FOLLOW_UP",
      crm_note: "Additional emails: jdoe@work.com",
      data_source: "",
      possession_time: "",
      description: "",
      skipped: false,
      skip_reason: "",
    },
    {
      row_index: 1,
      created_at: "",
      name: "No Contact Person",
      email: "",
      country_code: "",
      mobile_without_country_code: "",
      company: "Ghost Corp",
      city: "Nowhere",
      state: "",
      country: "",
      lead_owner: "",
      crm_status: "",
      crm_note: "",
      data_source: "",
      possession_time: "",
      description: "",
      skipped: true,
      skip_reason: "No email or mobile number",
    },
  ],
};

/** Build the chat messages for a single batch of rows. */
export function buildMessages(rows: Record<string, unknown>[]): { role: "system" | "user" | "assistant"; content: string }[] {
  const indexed = rows.map((row, i) => ({ row_index: i, ...row }));
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(FEW_SHOT_INPUT) },
    { role: "assistant", content: JSON.stringify(FEW_SHOT_OUTPUT) },
    { role: "user", content: JSON.stringify({ rows: indexed }) },
  ];
}
