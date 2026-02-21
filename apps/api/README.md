# ClearCost API (apps/api)

Fastify + Bun service that powers quoting, imports (official + LLM-backed), FX, and operational tasks. Ships with
Prometheus metrics, provenance/locking for batch jobs, and a small cron CLI.

---

## Stack

- **Runtime:** Bun / Node 18+
- **Web:** Fastify 5, Zod schemas
- **DB:** PostgreSQL + Drizzle ORM
- **Metrics:** prom-client (/metrics, **requires scope:** `ops:metrics`)
- **Lang:** TypeScript

---

## Directory layout

```
apps/api/
  src/
    lib/
      cron/                   # CLI runner + command registry
        commands/             # import/fx/hs/llm commands
        registry.ts           # maps command name -> implementation
        runtime.ts            # CLI locking/provenance helpers
      run-cron.ts             # CLI entrypoint
      metrics.ts              # import counters/timers helpers
      provenance.ts           # start/finish runs (+ heartbeat)
      refresh-fx.ts           # ECB FX fetch/parse/upsert
      run-lock.ts             # advisory locks (pg based)
      sweep-stale-imports.ts  # mark stale running imports failed
    modules/
      quotes/                 # /v1/quotes endpoints
      hs-codes/               # HS aliases + imports (EU/WITS/US/UK)
      duty-rates/
        services/
          llm/                # OpenAI + Grok fetchers, cross-check, ingest
          compute-duty.ts     # effective rate calculator (components → %)
      surcharges/
        services/
          llm/                # OpenAI + Grok fetchers, cross-check, ingest
      vat/
        services/
          llm/                # OpenAI + Grok fetchers, cross-check, ingest
      de-minimis/
        services/
          llm/                # OpenAI + Grok fetchers + prompts
      freight/                # freight cards importer
      health/                 # /health, /healthz, /health/imports
      tasks/                  # internal /cron routes (ops)
      webhooks/               # webhook dispatch scaffolding
      api-keys/               # x-api-key auth management
    plugins/
      api-key-auth.ts         # Fastify plugin for x-api-key / admin
      api-usage.ts            # usage metering to db
      import-instrumentation.ts # provenance + timers + heartbeats
      prometheus/
        metrics-http.ts       # HTTP request metrics
        imports-extra.ts      # totals, last-run gauges, etc.
        imports-running.ts    # running-age gauges (optional)
  types/
    import-instrumentation.d.ts # Fastify module augmentation
  test/                     # integration/unit tests
  tsconfig.json             # main build config
  tsconfig.test.json        # test-only tsconfig
```

---

## Environment

Create `apps/api/.env` (examples):

```env
NODE_ENV=development
PORT=4000
INTERNAL_PORT=4001
INTERNAL_HOST=0.0.0.0
HOST=0.0.0.0
DATABASE_URL=postgres://user:pass@localhost:5432/clearcost
TRUST_PROXY=false
ALLOW_INTERNAL_BIND=0

# Public API base (also used by Swagger servers[]):
CLEARCOST_API_URL=http://localhost:4000

# Internal API base (used by CI/ops for /internal/*):
CLEARCOST_INTERNAL_API_URL=http://localhost:4001

# Internal signing (required in production for /internal/*)
INTERNAL_SIGNING_SECRET=change-me

# FX + data
CURRENCY_BASE=USD

# EU TARIC (required for EU duty importers)
EU_TARIC_MEASURE_URL=...
EU_TARIC_COMPONENT_URL=...
EU_TARIC_DUTY_EXPR_URL=...                # optional but recommended
EU_TARIC_GEO_DESC_URL=...                 # optional (preferential labels)
EU_TARIC_GOODS_URL=...                    # optional (legacy goods endpoints)
EU_TARIC_GOODS_DESC_URL=...               # optional (legacy goods endpoints)
EU_TARIC_LANGUAGE=EN

# HS aliases (AHTN etc.)
AHTN_CSV_URL=...

# Surcharges
UK_REMEDY_MEASURE_TYPES=552,551,695
EU_TARIC_REMEDY_TYPES=...

# LLM importers (optional)
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
XAI_API_KEY=...                           # or GROK_API_KEY
GROK_MODEL=grok-2-latest

# Optional tuning
LLM_DUTY_SOURCE=llm                       # source tag for duty upserts
IMPORT_STALE_MINUTES=30                   # sweeper
```

> API keys are stored in DB (see `api-keys` module). Clients authenticate with `x-api-key`.
> Internal/ops routes require scoped API keys and (in production) `x-cc-ts` + `x-cc-sig` request signing.
> Set `TRUST_PROXY` to `true` or a hop count when running behind a reverse proxy.
> Internal server binds are guarded in production unless `ALLOW_INTERNAL_BIND=1`.

---

## Install & Run

```bash
# from repo root
bun install

# migrate DB (from packages/db)
bun run --cwd packages/db migrate

# dev: watch mode
bunx turbo run dev            # or: bun --cwd apps/api dev

# build + start (prod)
bun run --cwd apps/api build
bun run --cwd apps/api start
```

The API starts two servers:

- Public server: `HOST` + `PORT` (default `0.0.0.0:3001`)
- Internal server: `INTERNAL_HOST` + `INTERNAL_PORT` (default `0.0.0.0:3002`)

## MVP Demo Seed (US/NL -> NL/DE)

Use this when you want a deterministic local dataset for the scoped MVP quote flow.
All monetary values in quote computation are handled with ISO-4217 currency codes (never country codes).
Country -> currency mapping lives in `packages/types/src/schemas/country-currency.ts`.

```bash
# from repo root
docker compose up -d db

# set DB URL for local compose Postgres
export DATABASE_URL=postgres://clearcost:clearcost@localhost:5432/clearcost

# run migrations + seed
bun run --cwd packages/db migrate
bun run --cwd apps/api seed:mvp

# start API
bun run --cwd apps/api dev
```

Working quote example (requires a valid `x-api-key` with `quotes:write`):

```bash
curl -s \\
  -H "x-api-key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: mvp-demo-$(uuidgen | tr -d -)" \\
  -d '{\"origin\":\"US\",\"dest\":\"NL\",\"itemValue\":{\"amount\":100,\"currency\":\"USD\"},\"dimsCm\":{\"l\":20,\"w\":15,\"h\":10},\"weightKg\":1.2,\"categoryKey\":\"electronics_accessories\",\"hs6\":\"850440\",\"mode\":\"air\"}' \\
  http://localhost:3001/v1/quotes | jq .
```

---

## OpenAPI & Docs

- **Spec:** `GET /openapi.json`
- **UI:** `GET /docs` (Swagger UI; deep-linking + auth persistence enabled)
- Default security scheme: `x-api-key`. Internal signing header (`x-cc-sig`) is documented as an additional scheme.

Example (curl):

```bash
curl -s \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ck_idem_$(uuidgen | tr -d -)" \
  -d '{"origin":"US","dest":"DE","itemValue":{"amount":120,"currency":"USD"},"dimsCm":{"l":20,"w":15,"h":10},"weightKg":1.2,"categoryKey":"general","mode":"air"}' \
  $CLEARCOST_API_URL/v1/quotes | jq .
```

**Internal signing (required in production for /internal/\*):**

```
x-cc-ts: <epoch ms>
x-cc-sig: sha256(hex) of "<ts>:<method>:<url>:<sha256(body)>" + '|' + INTERNAL_SIGNING_SECRET
```

---

## Public API

### `POST /v1/quotes`

Compute a landed cost quote (idempotent via `Idempotency-Key` header).

- **Auth:** `x-api-key: <key with scope quotes:write>`
- **Body:** `QuoteInputSchema` from `@clearcost/types`
- **Response:** `QuoteResponseSchema` (total, components, guardrail)

### `GET /v1/quotes/by-key/:key`

Return the cached successful response for an idempotency key.

### `GET /v1/quotes/replay?key=...&scope=quotes`

Fetch a cached response by key/scope for debugging.

> HS search/classify endpoints live in `src/modules/hs-codes` / `src/modules/classify` (enable as needed).

### `GET /metrics` (internal server)

Prometheus scrape endpoint.

- **Auth:** `x-api-key: <key with scope ops:metrics>` (internal signing is required by default in production; set `METRICS_REQUIRE_SIGNING=0` to opt out)

---

## Internal /cron routes (ops)

Routes are defined under `/cron/**` in code and mounted with the `/internal` prefix in `apps/api/src/server.ts`, so the
external URLs are `/internal/cron/**` on the internal server (`INTERNAL_PORT`).

All require scoped API keys (e.g. `tasks:*` or `ops:*`) and internal request signing in production. Invoked by GitHub
Actions or ops manually. List below is not exhaustive.

Internal health (no signature required):

- `GET /internal/healthz`

Internal ops client (recommended):

```bash
export CLEARCOST_INTERNAL_API_URL="http://localhost:4001"
export CLEARCOST_TASKS_API_KEY="ck_..."
export INTERNAL_SIGNING_SECRET="..."

bun run internal-request -- --path /internal/cron/fx/daily --body '{}'
```

- **FX**
  - `POST /internal/cron/fx/daily` — refresh ECB rates

- **VAT**
  - `POST /internal/cron/import/vat/auto` — OECD/IMF merge and import

- **Duties**
  - `POST /internal/cron/import/duties/us-mfn`
  - `POST /internal/cron/import/duties/us-preferential`
  - `POST /internal/cron/import/duties/eu-mfn`
  - `POST /internal/cron/import/duties/eu-fta`
  - `POST /internal/cron/import/duties/uk-mfn`
  - `POST /internal/cron/import/duties/uk-fta`
  - `POST /internal/cron/import/duties/wits`
  - `POST /internal/cron/import/duties/wits/asean`
  - `POST /internal/cron/import/duties/wits/japan`
  - `POST /internal/cron/import/duties/cn-mfn` (official PDF default)
  - `POST /internal/cron/import/duties/cn-mfn/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/cn-fta` (strict official default)
  - `POST /internal/cron/import/duties/cn-fta/wits` (WITS explicit)
  - `POST /internal/cron/import/duties/cn-mfn/official/pdf`
  - `POST /internal/cron/import/duties/jp-mfn`
  - `POST /internal/cron/import/duties/jp-fta` (strict official default)
  - `POST /internal/cron/import/duties/jp-fta/wits` (WITS explicit)
  - `POST /internal/cron/import/duties/my-mfn` (official Excel default)
  - `POST /internal/cron/import/duties/my-mfn/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/my-fta` (official Excel default)
  - `POST /internal/cron/import/duties/my-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/my-mfn/official/excel`
  - `POST /internal/cron/import/duties/my-mfn/official/pdf`
  - `POST /internal/cron/import/duties/my-fta/official/excel`
  - `POST /internal/cron/import/duties/sg-mfn` (official Excel default)
  - `POST /internal/cron/import/duties/sg-mfn/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/sg-mfn/official/excel`
  - `POST /internal/cron/import/duties/sg-fta` (official Excel default)
  - `POST /internal/cron/import/duties/sg-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/sg-fta/official/excel`
  - `POST /internal/cron/import/duties/th-mfn` (official Excel default)
  - `POST /internal/cron/import/duties/th-mfn/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/th-mfn/official/excel`
  - `POST /internal/cron/import/duties/th-fta` (official Excel default)
  - `POST /internal/cron/import/duties/th-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/th-fta/official/excel`
  - `POST /internal/cron/import/duties/vn-mfn` (official Excel default)
  - `POST /internal/cron/import/duties/vn-mfn/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/vn-mfn/official/excel`
  - `POST /internal/cron/import/duties/vn-fta` (official Excel default)
  - `POST /internal/cron/import/duties/vn-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/vn-fta/official/excel`
  - `POST /internal/cron/import/duties/ph-mfn`
  - `POST /internal/cron/import/duties/ph-mfn/wits`
  - `POST /internal/cron/import/duties/ph-fta` (official Excel default)
  - `POST /internal/cron/import/duties/ph-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/ph-fta/official/excel`
  - `POST /internal/cron/import/duties/id-mfn`
  - `POST /internal/cron/import/duties/id-fta` (official Excel default)
  - `POST /internal/cron/import/duties/id-fta/wits` (WITS fallback)
  - `POST /internal/cron/import/duties/id-fta/official/excel`
  - `POST /internal/cron/id/btki/crawl`

- **Surcharges**
  - `POST /internal/cron/import/surcharges/us-trade-remedies`
  - `POST /internal/cron/import/surcharges/us-all`
  - `POST /internal/cron/import/surcharges/eu-remedies`
  - `POST /internal/cron/import/surcharges/uk-remedies`
  - `POST /internal/cron/import/surcharges` (generic JSON)

- **Freight**
  - `POST /internal/cron/import/freight` (JSON cards)

- **HS tables**
  - `POST /internal/cron/import/hs/eu-hs6`
  - `POST /internal/cron/import/hs/ahtn`

- **De‑minimis**
  - `POST /internal/cron/de-minimis/import-zonos`
  - `POST /internal/cron/de-minimis/import-official`
  - `POST /internal/cron/de-minimis/seed-baseline`

- **Ops maintenance**
  - `POST /internal/cron/imports/sweep-stale` — mark stuck runs failed
  - `POST /internal/cron/imports/prune` — delete old imports/provenance

- `GET /internal/notices` — internal notices browsing (tasks scope)
- `GET /internal/notices/:id` — internal notices detail (tasks scope)

## GitHub Actions cron runbook (env/secrets matrix)

These workflows are the production schedulers:

- `.github/workflows/cron-daily-http.yml`
- `.github/workflows/cron-hourly-http.yml`
- `.github/workflows/cron-weekly-cli.yml`
- `.github/workflows/cron-daily-cli.yml`

### Common HTTP cron requirements

Both HTTP workflows (`cron-daily-http.yml` and `cron-hourly-http.yml`) require:

| Name                         | Source | Required | Notes                                                            |
| ---------------------------- | ------ | -------- | ---------------------------------------------------------------- |
| `CLEARCOST_INTERNAL_API_URL` | secret | yes      | Base URL for internal server (`/internal/*`).                    |
| `CLEARCOST_TASKS_API_KEY`    | secret | yes      | Must include required `tasks:*` scopes for triggered endpoints.  |
| `INTERNAL_SIGNING_SECRET`    | secret | yes      | Used by `scripts/internal-request.ts` to sign internal requests. |

### `cron-daily-http.yml`

| Name                        | Source | Required | Used for                                             |
| --------------------------- | ------ | -------- | ---------------------------------------------------- |
| `ID_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required ID FTA official Excel import source URL.    |
| `MY_MFN_OFFICIAL_EXCEL_URL` | secret | yes      | Required MY MFN official Excel import source URL.    |
| `MY_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required MY FTA official Excel import source URL.    |
| `PH_TARIFF_EXCEL_URL`       | secret | yes      | Required PH MFN official Excel import source URL.    |
| `PH_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required PH FTA official Excel import source URL.    |
| `TH_MFN_OFFICIAL_EXCEL_URL` | secret | yes      | Required TH MFN official Excel import source URL.    |
| `TH_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required TH FTA official Excel import source URL.    |
| `VN_MFN_OFFICIAL_EXCEL_URL` | secret | yes      | Required VN MFN official Excel import source URL.    |
| `VN_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required VN FTA official Excel import source URL.    |
| `SG_MFN_OFFICIAL_EXCEL_URL` | secret | yes      | Required SG MFN official Excel import source URL.    |
| `SG_FTA_OFFICIAL_EXCEL_URL` | secret | yes      | Required SG FTA official Excel import source URL.    |
| `UK_REMEDY_MEASURE_TYPES`   | var    | no       | UK remedy measure types (defaults to `552,551,695`). |
| `EU_TARIC_REMEDY_TYPES`     | var    | no       | Enables EU remedies surcharge import when non-empty. |
| `IMPORTS_PRUNE_DAYS`        | var    | no       | Retention window for prune step (default `90`).      |
| `SLACK_WEBHOOK_URL`         | secret | no       | Success/failure notifications.                       |
| `DISCORD_WEBHOOK_URL`       | secret | no       | Success/failure notifications.                       |

### `cron-hourly-http.yml`

| Name                              | Source | Required | Used for                                                                     |
| --------------------------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `IMPORTS_SWEEP_THRESHOLD_MINUTES` | var    | no       | Stale run threshold for `/internal/cron/imports/sweep-stale` (default `30`). |
| `SLACK_WEBHOOK_URL`               | secret | no       | Success/failure notifications.                                               |
| `DISCORD_WEBHOOK_URL`             | secret | no       | Success/failure notifications.                                               |

### `cron-weekly-cli.yml`

| Name                  | Source | Required | Used for                                                  |
| --------------------- | ------ | -------- | --------------------------------------------------------- |
| `DATABASE_URL`        | secret | yes      | Direct DB import jobs via CLI runtime.                    |
| `DATA_REMOTE_BASE`    | secret | no       | Enables freight cards JSON import step.                   |
| `AHTN_SOURCE_URL`     | secret | no       | Enables AHTN alias import step.                           |
| `CN_MFN_PDF_URL`      | secret | no       | Enables CN MFN PDF importer step.                         |
| `TABULA_JAR_URL`      | var    | no       | Override Tabula jar URL for CN PDF parsing (has default). |
| `SLACK_WEBHOOK_URL`   | secret | no       | Success/failure notifications.                            |
| `DISCORD_WEBHOOK_URL` | secret | no       | Success/failure notifications.                            |

US duties/surcharges are intentionally run in `cron-daily-http.yml` for fresher data and fail-fast checks.

### `cron-daily-cli.yml`

| Name           | Source | Required | Used for                                                              |
| -------------- | ------ | -------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | secret | yes      | CN notices crawl + attachment jobs + `report:coverage` snapshot gate. |

### Failure behavior (intentional)

Critical workflow steps are configured to fail fast when imports return no usable activity:

- `cron-daily-http.yml`: FX must return `fxAsOf`; VAT; duty imports (EU daily, JP MFN/FTA, UK MFN/FTA, ID MFN + ID/MY/PH/TH/VN/SG FTA official Excel, MY/PH/TH/VN/SG MFN official Excel, CN MFN/FTA, US MFN/FTA); US/UK/EU remedy surcharges; and de-minimis imports must report rows (`count/inserted/updated > 0`).
- `cron-daily-cli.yml`: `report:coverage` fails when MVP-required official freshness/coverage checks fail; when ASEAN FTA duty jobs (`duties:id-fta-official`, `duties:my-fta-excel`, `duties:ph-fta-official`, `duties:th-fta-official`, `duties:vn-fta-official`, `duties:sg-fta-official`) or ASEAN MFN duty jobs (`duties:id-mfn`, `duties:my-mfn-excel`, `duties:ph-mfn-official`, `duties:th-mfn-official`, `duties:vn-mfn-official`, `duties:sg-mfn-official`) are missing/stale; when JP/CN duty jobs (`duties:jp-mfn`, `duties:jp-fta-official`, `duties:cn-mfn-official`, `duties:cn-fta-official`) are missing/stale; when UK/US duty jobs (`duties:uk-mfn`, `duties:uk-fta`, `duties:us-mfn`, `duties:us-fta`) are missing/stale; when required duty source_registry keys are missing/disabled; when required ASEAN sample lanes (HS6 `850440`) are missing at the partner level; and when JP/CN/UK/US duty datasets are missing official MFN/FTA coverage.
- `cron-weekly-cli.yml`: EU HS6, WITS duty imports (`fetchedRows > 0`), and freight JSON import (`count > 0`) fail the run if empty.

This is deliberate so source/parser drift is visible in CI instead of silently succeeding with stale data.

---

## Cron/CLI usage

The CLI wraps long-running imports in provenance + metrics.

```bash
cd apps/api
# list available commands
bun run src/lib/cron/index.ts --help

# examples
bun run src/lib/cron/index.ts fx:refresh
bun run src/lib/cron/index.ts import:vat
bun run src/lib/cron/index.ts import:duties:llm-openai --model gpt-4o-mini
bun run src/lib/cron/index.ts import:surcharges:llm-crosscheck --mode strict
bun run src/lib/cron/index.ts import:hs:eu-hs6
bun run src/lib/cron/index.ts import:sweep-stale --threshold 30
bun run src/lib/cron/index.ts report:coverage --out=artifacts/coverage-snapshot.json
```

Command registry: `src/lib/cron/registry.ts` (implementations under `src/lib/cron/commands/*`).

---

## Auth

- **Client APIs:** `x-api-key` (row in DB), enforced by `plugins/api-key-auth.ts`.
- **Admin /cron:** scoped API keys (e.g. `tasks:*`, `ops:*`) on the internal server.
- **Internal signing:** `x-cc-ts` + `x-cc-sig` required in production for internal routes.
- **Scopes:** routes declare scopes, e.g. `quotes:write`.

---

## Observability

- **Prometheus** at `GET /metrics` (internal server)
  - HTTP: `http_server_request_duration_seconds`, `http_server_requests_total`
  - Import batch: `clearcost_import_rows_inserted_total`, `clearcost_import_errors_total`,
    `clearcost_import_last_run_timestamp`
  - Optional running-age gauges (see `plugins/prometheus/imports-running.ts`)

- **Health**
  - `GET /healthz` (HEAD also)
  - `GET /health`
  - `GET /v1/admin/health/imports?thresholdHours=36` — recent provenance summary (internal server)

---

## Provenance & job instrumentation

Routes can opt-in by setting `config.importMeta`:

```ts
app.post(
  '/internal/cron/import/duties/us-mfn',
  {
    preHandler: adminGuard,
    config: { importMeta: { source: 'USITC_HTS', job: 'duties:us-mfn' } },
  },
  async (req, reply) => {
    // req.importCtx = { meta, runId, endTimer }
    const res = await importUsMfn(/* pass req.importCtx?.runId if importer supports */);
    return reply.send(res);
  }
);
```

The plugin will:

- start a Prometheus timer and a DB `imports` row
- heartbeat every 30s (so sweeper can detect stalls)
- on response: infer `inserted` from payload `{ inserted | count }`, record success/failure

---

## Locks & sweeper

- `lib/run-lock.ts` — pg advisory lock helpers (with tests)
- `lib/sweep-stale-imports.ts` — flips `running` → `failed` when no heartbeat for N minutes
- Routes & CLI available (see above) and GitHub Actions (`.github/workflows/cron-hourly.yml`).

---

## Testing

- **Runner:** `bun test`
- **Examples:**
  - `src/lib/run-lock.unit.test.ts`
  - `src/lib/sweep-stale-imports.test.ts`
  - `src/modules/**/` (add integration tests under `test/`)

Run:

```bash
cd apps/api
bun test
```

CI workflow: `.github/workflows/api-tests.yml`.

---

## Troubleshooting

- **TS augmentation not picked up**: ensure `apps/api/types/**/*.d.ts` is included in `tsconfig.json`.
- **Prometheus types**: use the module augmentation in `types/import-instrumentation.d.ts` for Fastify extras.
- **DB errors**: verify `DATABASE_URL` and run migrations from `packages/db`.
- **Admin routes 401**: ensure your API key includes the required `admin:*` or `ops:*` scope.
- **LLM imports**: ensure `OPENAI_API_KEY` or `XAI_API_KEY` is set before running `import:*:llm-*` commands.

---

## License

MIT — see root `LICENSE`.
