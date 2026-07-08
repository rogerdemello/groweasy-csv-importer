# GrowEasy — AI-Powered CSV Importer

Upload **any** CSV — Facebook / Google Ads exports, Excel sheets, real-estate CRM
dumps, sales reports, hand-made spreadsheets — and this app uses an LLM to
intelligently map its columns into the fixed **GrowEasy CRM schema**, then streams
the cleaned, validated records back to the browser.

> The hard part isn't parsing CSV. It's handling **different column names, layouts,
> and structures** and still extracting the right CRM fields. That mapping is done
> by the AI; a deterministic post-processing layer then **guarantees** every
> business rule holds.

- **Frontend:** Next.js (App Router) + Tailwind — upload → preview → confirm → results
- **Backend:** Node.js + Express (custom server) — parse → batch → AI extract → stream
- **AI:** any OpenAI-compatible endpoint (default: **NVIDIA NIM**), with a no-key **mock mode**
- **One service, one URL** (deployable on Render); stateless (no database)

---

## Table of contents

- [Live demo & deployment](#live-demo--deployment)
- [Architecture](#architecture)
- [How the AI extraction works](#how-the-ai-extraction-works-the-core)
- [CRM schema & rules](#crm-schema--rules)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API](#api)
- [Testing](#testing)
- [Sample data](#sample-data)
- [Project structure](#project-structure)
- [Bonus features](#bonus-features)
- [Limitations](#limitations)

---

## Live demo & deployment

**Hosted URL:** https://groweasy-csv-importer-e14t.onrender.com

> Hosted on Render's free tier — the service may cold-start (~30–50s) on the first
> request after a period of inactivity, then stays fast.

### Deploy on Render (one service)

1. Push this repo to GitHub (already public).
2. On [render.com](https://render.com) → **New → Blueprint**, point at the repo.
   `render.yaml` is auto-detected (build `npm ci && npm run build`, start `npm start`).
3. Set the **`NVIDIA_API_KEY`** env var in the dashboard (free key from
   [build.nvidia.com](https://build.nvidia.com)). Leave it blank to run in mock mode.
4. Deploy. Health check: `GET /api/health`.

### Deploy with Docker

```bash
docker build -t groweasy-csv-importer .
docker run -p 3000:3000 -e NVIDIA_API_KEY=your_key groweasy-csv-importer
# open http://localhost:3000
```

---

## Architecture

One Node process, one port, one URL:

```
                    ┌──────────────────────────────────────────────┐
  Browser ──HTTP──► │  server/main.ts  (custom server)             │
                    │                                              │
                    │   /api/*  ──►  Express router                │
                    │                 └─ POST /api/import (NDJSON)  │
                    │                      └─ extractStream()       │
                    │                          ├─ batch rows        │
                    │                          ├─ LLM (retry/backoff)│
                    │                          ├─ heuristic fallback │
                    │                          └─ normalize (rules)  │
                    │                                              │
                    │   /*      ──►  Next.js (the React UI)         │
                    └──────────────────────────────────────────────┘
```

**Client flow (4 steps):** `Upload` → `Preview` (raw CSV, no AI) → `Confirm` →
`Result` (AI-mapped records stream in with a live progress bar).

CSV is parsed **client-side** (PapaParse) for the preview, so no AI runs until the
user confirms — exactly as specified.

---

## How the AI extraction works (the core)

The extraction is a pipeline of **model intelligence + deterministic guarantees**:

1. **Batching** — rows are split into batches (default 8) and processed
   independently so large files stream in and one bad batch can't sink the file.

2. **Prompt** (`server/services/prompt.ts`) — a carefully engineered system prompt
   teaches the model the GrowEasy schema (with per-field descriptions), the two
   **enum whitelists**, and every extraction rule. It includes a **few-shot
   example** demonstrating a messy header, multi-email handling, enum inference,
   and a skipped row. The model must return strict JSON keyed by `row_index`.

3. **Robust JSON recovery** (`server/services/llm.ts`) — the model output is parsed
   with a brace-matching scanner that survives code fences and surrounding prose.
   `response_format: json_object` is requested when the endpoint supports it, with
   an automatic fallback when it doesn't.

4. **Retry + fallback** (`server/services/extractor.ts`) — each batch retries with
   exponential backoff (default 3 attempts). If it still fails, the batch falls
   back to a **deterministic heuristic mapper** (`heuristic.ts`, fuzzy header
   matching) so **no row is ever lost**. When no API key is present (or
   `USE_MOCK=1`), the heuristic mapper handles everything — the app always runs.

5. **Deterministic normalization** (`server/services/normalize.ts`) — the layer
   that makes the output **trustworthy regardless of the model**. It:
   - coerces `crm_status` / `data_source` to their whitelist, else blank;
   - keeps `created_at` only if `new Date()` can parse it;
   - collects **all** emails/phones from the row, keeps the first of each and
     appends the rest to `crm_note` (with date/time guards so timestamps aren't
     mistaken for phone numbers);
   - escapes newlines so every record stays a single CSV row;
   - **skips** any row with neither an email nor a mobile.

This division of labour is the point: the LLM does the *fuzzy* work (what does this
column mean?), and code does the *exact* work (are the rules satisfied?).

---

## CRM schema & rules

| Field | Description |
|---|---|
| `created_at` | Lead creation date (must be `new Date()`-parseable) |
| `name` | Lead name |
| `email` | Primary email |
| `country_code` | Country dialing code (e.g. `+91`) |
| `mobile_without_country_code` | Mobile number (no country code) |
| `company` | Company name |
| `city` / `state` / `country` | Location |
| `lead_owner` | Lead owner |
| `crm_status` | One of the allowed statuses, or blank |
| `crm_note` | Remarks, extra emails/phones, anything that doesn't fit |
| `data_source` | One of the allowed sources, or blank |
| `possession_time` | Property possession time |
| `description` | Additional description |

**Allowed `crm_status`:** `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`
**Allowed `data_source`:** `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots`

Enforced rules: valid dates only · multi-email/phone → first kept, rest in note ·
single-line CSV-safe values · unknown fields left blank · rows without any contact
are skipped.

---

## Getting started

**Prerequisites:** Node.js ≥ 20.

```bash
npm install

# Run with no key (deterministic mock mode) — great for a first look:
npm run dev
# → http://localhost:3000

# Run with real AI extraction:
cp .env.example .env       # then set NVIDIA_API_KEY in .env
npm run dev
```

Production build:

```bash
npm run build
npm start
```

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NVIDIA_API_KEY` | _(unset → mock mode)_ | API key for the OpenAI-compatible endpoint |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Endpoint base URL |
| `LLM_MODEL` | `meta/llama-3.1-8b-instruct` | Model id |
| `LLM_TEMPERATURE` | `0` | Sampling temperature |
| `BATCH_SIZE` | `8` | Rows per model request |
| `MAX_RETRIES` | `3` | Retry attempts per batch before fallback |
| `REQUEST_TIMEOUT` | `60` | Per-request timeout (seconds) |
| `USE_MOCK` | `0` | Force heuristic mode even with a key |
| `PORT` | `3000` | Server port |

> Works with any OpenAI-compatible provider — point `NVIDIA_BASE_URL` / `LLM_MODEL`
> at OpenAI, Gemini's OpenAI-compat endpoint, Groq, etc.

---

## API

### `GET /api/health`
```json
{ "status": "ok", "mode": "ai", "model": "meta/llama-3.1-8b-instruct", "batchSize": 8 }
```

### `POST /api/import`
Request:
```json
{ "rows": [ { "Full Name": "John Doe", "Work Email": "john@x.com", "Phone": "+91 98765 43210" } ], "filename": "leads.csv" }
```
Response: **NDJSON** stream (one JSON object per line):
```
{"type":"start","totalRows":1,"totalBatches":1,"mode":"ai"}
{"type":"batch","batchIndex":0,"records":[{"rowIndex":0,"record":{...},"skipped":false,"source":"ai"}]}
{"type":"summary","summary":{"total":1,"imported":1,"skipped":0},"mode":"ai"}
```

---

## Testing

```bash
npm test          # vitest — unit tests for the rule engine
npm run typecheck # strict TypeScript check
```

Covered: enum coercion, date validation, skip rule, multi-email/multi-phone
handling, date-vs-phone disambiguation, CSV-safety, fuzzy header mapping, status
classification, and robust model-JSON recovery.

---

## Sample data

`sample-data/` contains four deliberately messy CSVs to try:

- `facebook-leads.csv` — Facebook Lead Ads headers, ISO dates, a no-contact row.
- `real-estate-crm.csv` — possession dates, multiple phones/emails, project names
  that map to `data_source`, a walk-in with no contact (skipped).
- `messy-sales-report.csv` — international numbers, free-text statuses, a fully
  empty row, quoted commas.

Upload any of them, confirm, and watch the mapping + skip decisions.

---

## Project structure

```
shared/crm.ts              # shared types, enums, field metadata, stream protocol
server/
  main.ts                  # Express + Next custom server (one port)
  app.ts                   # Express app factory (testable)
  config.ts                # env-driven config
  routes/import.ts         # GET /api/health, POST /api/import (NDJSON)
  services/
    prompt.ts              # system prompt + few-shot (prompt engineering)
    llm.ts                 # OpenAI-compatible client + robust JSON parsing
    extractor.ts           # batching, retry/backoff, streaming, fallback
    normalize.ts           # deterministic rule enforcement
    heuristic.ts           # fuzzy header mapper (mock + fallback)
  lib/batch.ts             # chunk / sleep / backoff
  __tests__/               # vitest unit tests
src/
  app/                     # layout, page (4-step flow), theme provider
  components/               # Uploader, Preview/Results tables, Stepper, etc.
  lib/                     # client CSV parse, NDJSON stream client, cn()
```

---

## Bonus features

Drag & drop upload · live progress indicator (streaming NDJSON) · streaming/
incremental parsing · per-batch retry with heuristic fallback · virtualized tables
(smooth on large CSVs) · dark mode · unit tests · Dockerfile · Render blueprint ·
CRM CSV export · this README.

UI is styled to match the GrowEasy product: brand green, an orange primary CTA,
GrowEasy-style status pills (Sale Done / Good Lead / Did Not Connect / Bad Lead),
a "Download Sample CSV Template" button, and a 5 MB upload limit.

---

## Limitations

- Phone parsing is heuristic; unusual formats (e.g. two space-separated numbers in
  one cell with no delimiter) may not split perfectly. The rule engine errs toward
  keeping data (extras land in `crm_note`) rather than dropping it.
- The default model (`llama-3.1-8b`) is chosen for reliability/latency; a larger
  model can be configured via `LLM_MODEL` for higher-accuracy mapping.
- Stateless by design — imports are not persisted server-side.
