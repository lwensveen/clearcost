# ClearCost API (apps/api)

Fastify + Bun service that powers quoting, imports (official + LLM-backed), FX, and operational tasks. Ships with
Prometheus metrics, provenance/locking for batch jobs, and a small cron CLI.

---

## Stack

- **Runtime:** Bun / Node 18+
- **Web:** Fastify 5, Zod schemas
- **DB:** PostgreSQL + Drizzle ORM
- **Metrics:** prom-client (/metrics)
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
        runtime.ts            # CLI entry
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
DATABASE_URL=postgres://user:pass@localhost:5432/clearcost

# Admin / ops
ADMIN_TOKEN=dev-admin-token              # header: x-admin-token

# FX + data
CURRENCY_BASE=USD

# EU TARIC (when running EU importers)
EU_TARIC_GOODS_URL=...
EU_TARIC_GOODS_DESC_URL=...
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

> API keys are stored in DB (see `api-keys` module). Clients authenticate with `x-api-key`. Internal/ops routes can use
> `x-admin-token` **or** scoped keys.

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

---

## Scripts (package.json)

```jsonc
{
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/main.js",
    "check-types": "tsc --noEmit",
    "cron": "bun run src/lib/cron/index.ts",

    // FX
    "fx:refresh": "bun run src/lib/cron/index.ts fx:refresh",

    // VAT (official) + LLM
    "import:vat": "bun run src/lib/cron/index.ts import:vat",
    // (add LLM VAT commands when wired into registry)

    // Duties (official + LLM)
    "import:duties": "bun run src/lib/cron/index.ts import:duties",
    "import:duties:wits": "bun run src/lib/cron/index.ts import:duties:wits",
    "import:duties:us-mfn": "bun run src/lib/cron/index.ts import:duties:us-mfn",
    "import:duties:us-fta": "bun run src/lib/cron/index.ts import:duties:us-fta",
    "import:duties:us-all": "bun run src/lib/cron/index.ts import:duties:us-all",
    "import:duties:llm-openai": "bun run src/lib/cron/index.ts import:duties:llm-openai",
    "import:duties:llm-grok": "bun run src/lib/cron/index.ts import:duties:llm-grok",
    "import:duties:llm-crosscheck": "bun run src/lib/cron/index.ts import:duties:llm-crosscheck",

    // Surcharges (official + LLM)
    "import:surcharges": "bun run src/lib/cron/index.ts import:surcharges",
    "import:surcharges:us-all": "bun run src/lib/cron/index.ts import:surcharges:us-all",
    "import:surcharges:us-trade-remedies": "bun run src/lib/cron/index.ts import:surcharges:us-trade-remedies",
    "import:surcharges:us-aphis": "bun run src/lib/cron/index.ts import:surcharges:us-aphis",
    "import:surcharges:us-fda": "bun run src/lib/cron/index.ts import:surcharges:us-fda",
    "import:surcharges:llm-openai": "bun run src/lib/cron/index.ts import:surcharges:llm-openai",
    "import:surcharges:llm-grok": "bun run src/lib/cron/index.ts import:surcharges:llm-grok",
    "import:surcharges:llm-crosscheck": "bun run src/lib/cron/index.ts import:surcharges:llm-crosscheck",

    // HS
    "import:hs6": "bun run src/lib/cron/index.ts import:hs6",
    "import:hs:us-hts10": "bun run src/lib/cron/index.ts import:hs:us-hts10",
    "import:hs:uk10": "bun run src/lib/cron/index.ts import:hs:uk10",
    "import:hs:ahtn": "bun run src/lib/cron/index.ts import:hs:ahtn",
    "import:hs:eu-hs6": "bun run src/lib/cron/index.ts import:hs:eu-hs6",
    "import:hs:eu-taric": "bun run src/lib/cron/index.ts import:hs:eu-taric",

    // De‑minimis (official + LLM)
    "import:de-minimis:zonos": "bun run src/lib/cron/index.ts import:de-minimis:zonos",
    "import:de-minimis:official": "bun run src/lib/cron/index.ts import:de-minimis:official",
    "import:de-minimis:seed-baseline": "bun run src/lib/cron/index.ts import:de-minimis:seed-baseline",
    "import:de-minimis:trade-gov": "bun run src/lib/cron/index.ts import:de-minimis:trade-gov",
    "import:de-minimis:openai": "bun run src/lib/cron/index.ts import:de-minimis:openai",

    // Freight
    "import:freight": "bun run src/lib/cron/index.ts import:freight",

    // Ops
    "import:sweep-stale": "bun run src/lib/cron/index.ts import:sweep-stale",
    "import:prune": "bun run src/lib/cron/index.ts import:prune",
  },
}
```

### Cron/CLI usage

The CLI wraps long-running imports in provenance + metrics.

```bash
cd apps/api
# list available commands
bun run src/lib/cron/index.ts --help

# examples
bun run src/lib/cron/index.ts fx:refresh

# official VAT
bun run src/lib/cron/index.ts import:vat

# LLM duties
bun run src/lib/cron/index.ts import:duties:llm-openai --model gpt-4o-mini
bun run src/lib/cron/index.ts import:duties:llm-grok --model grok-2-latest
bun run src/lib/cron/index.ts import:duties:llm-crosscheck --mode prefer_official

# LLM surcharges
bun run src/lib/cron/index.ts import:surcharges:llm-openai
bun run src/lib/cron/index.ts import:surcharges:llm-grok
bun run src/lib/cron/index.ts import:surcharges:llm-crosscheck --mode strict

# De‑minimis (LLM + official)
bun run src/lib/cron/index.ts import:de-minimis:openai
bun run src/lib/cron/index.ts import:de-minimis:official

# HS & ops
bun run src/lib/cron/index.ts import:hs:eu-hs6
bun run src/lib/cron/index.ts import:sweep-stale --threshold 30
bun run src/lib/cron/index.ts import:prune --days 90
```

Command registry lives at: `src/lib/cron/registry.ts` with implementations under `src/lib/cron/commands/*`.

---

## Public API

### `POST /v1/quotes`

Compute a landed cost quote (idempotent via `Idempotency-Key` header).

- **Auth:** `x-api-key: <key with scope quotes:write>`
- **Body:** see `src/modules/quotes/schemas.ts`
- **Response:** `QuoteResponseSchema` (total, components, guardrail)

### `GET /v1/quotes/by-key/:key`

Return the cached successful response for an idempotency key.

### `GET /v1/quotes/replay?key=...&scope=quotes`

Fetch a cached response by key/scope for debugging.

> HS search/classify endpoints live in `src/modules/hs-codes` / `src/modules/classify` (enable as needed).

---

## Internal /cron routes (ops)

All require admin auth or a scoped API key. Invoked by GitHub Actions or ops manually.

- **FX**
  - `POST /internal/cron/fx/daily` — refresh ECB rates

- **VAT**
  - `POST /internal/cron/import/vat/auto` — OECD/IMF merge and import

- **Duties**
  - `POST /internal/cron/import/duties/us-mfn`
  - `POST /internal/cron/import/duties/us-preferential`
  - `POST /internal/cron/import/duties/eu-mfn`
  - `POST /internal/cron/import/duties/uk-mfn`
  - `POST /internal/cron/import/duties/wits`

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

- **Ops maintenance**
  - `POST /internal/cron/imports/sweep-stale` — mark stuck runs failed
  - `POST /internal/cron/imports/prune` — delete old imports/provenance

---

## Auth

- **Client APIs:** `x-api-key` (row in DB), enforced by `plugins/api-key-auth.ts`.
- **Admin /cron:** `x-admin-token` must match `ADMIN_TOKEN` (or use scoped keys).
- **Scopes:** routes declare scopes, e.g. `quotes:write`.

---

## Observability

- **Prometheus** at `GET /metrics`
  - HTTP: `http_server_request_duration_seconds`, `http_server_requests_total`
  - Import batch: `clearcost_import_rows_inserted_total`, `clearcost_import_errors_total`,
    `clearcost_import_last_run_timestamp`
  - Optional running-age gauges (see `plugins/prometheus/imports-running.ts`)

- **Health**
  - `GET /healthz` (HEAD also)
  - `GET /health`
  - `GET /health/imports?thresholdHours=36` — recent provenance summary

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

The plugin (`plugins/import-instrumentation.ts`) will:

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
- **Config:** `tsconfig.test.json`
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
- **Admin routes 401**: set `ADMIN_TOKEN` and send header `x-admin-token`.
- **LLM imports**: ensure `OPENAI_API_KEY` or `XAI_API_KEY` is set before running `import:*:llm-*` commands.

---

## License

MIT — see root `LICENSE`.
