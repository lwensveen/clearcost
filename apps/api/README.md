# ClearCost API (apps/api)

Fastify + Bun service that powers quoting, imports, FX, and operational tasks. Ships with Prometheus metrics,
provenance/locking for batch jobs, and a small cron CLI.

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
      cron/                 # CLI runner + command registry
      metrics.ts            # import counters/timers helpers
      provenance.ts         # start/finish runs (+ heartbeat)
      refresh-fx.ts         # ECB FX fetch/parse/upsert
      run-lock.ts           # advisory locks (pg based)
      sweep-stale-imports.ts# mark stale running imports failed
    modules/
      quotes/               # /v1/quotes endpoints
      hs-codes/             # HS aliases + imports (EU/WITS/US/UK)
      duty-rates/           # duties importers (WITS/UK/US/EU)
      surcharges/           # MPF/HMF/301/232/AD/CVD importers
      freight/              # freight cards importer
      vat/                  # VAT import from OECD/IMF
      health/               # /health, /healthz, /health/imports
      tasks/                # internal /cron routes (ops)
      webhooks/             # webhook dispatch scaffolding
      api-keys/             # x-api-key auth management
    plugins/
      api-key-auth.ts       # Fastify plugin for x-api-key / admin
      api-usage.ts          # usage metering to db
      import-instrumentation.ts # provenance + timers + heartbeats
      prometheus/
        metrics-http.ts     # HTTP request metrics
        imports-extra.ts    # totals, last-run gauges, etc.
        imports-running.ts  # running-age gauges (optional)
  types/
    import-instrumentation.d.ts # Fastify module augmentation
  test/                   # integration/unit tests
  tsconfig.json           # main build config
  tsconfig.test.json      # test-only tsconfig
```

---

## Environment

Create `apps/api/.env` (examples):

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://user:pass@localhost:5432/clearcost
# Auth
ADMIN_TOKEN=dev-admin-token   # header: x-admin-token
# Optional: FX / data fetch tuning
CURRENCY_BASE=USD
EU_TARIC_GOODS_URL=...        # when running EU TARIC importer
EU_TARIC_GOODS_DESC_URL=...
EU_TARIC_LANGUAGE=EN
AHTN_CSV_URL=...              # for AHTN aliases
# Surcharge envs
UK_REMEDY_MEASURE_TYPES=552,551,695
EU_TARIC_REMEDY_TYPES=...
# Sweeper
IMPORT_STALE_MINUTES=30
```

> API keys are stored in DB (see `api-keys` module). Clients authenticate with `x-api-key`. Internal/ops routes use
> `x-admin-token`.

---

## Install & Run

```bash
# from repo root
bun install

# migrate DB (from packages/db)
bun run --cwd packages/db migrate

# dev: watch mode
bunx turbo run dev           # or: bun --cwd apps/api run src/server.ts

# build + start (prod)
bun run --cwd apps/api build
bun run --cwd apps/api start
```

---

## Scripts (package.json)

```jsonc
{
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/server.js",
    "check-types": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "test": "bun test",
    "cron": "bun run src/lib/cron/runtime.ts",
    "task": "bun run src/lib/cron/runtime.ts", // alias
  },
}
```

### Cron/CLI usage

The CLI wraps long-running imports in provenance + metrics.

```bash
cd apps/api
# list available commands
bun run src/lib/cron/runtime.ts --help

# examples
bun run src/lib/cron/runtime.ts fx:refresh
bun run src/lib/cron/runtime.ts import:vat
bun run src/lib/cron/runtime.ts import:duties:wits --dests=SG,MY --backfillYears=1
bun run src/lib/cron/runtime.ts imports:sweep-stale --threshold 30 --limit 100
bun run src/lib/cron/runtime.ts imports:prune --days 90
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

All require admin auth unless noted. These are invoked by GitHub Actions or ops manually.

- **FX**
  - `POST /internal/cron/fx/daily` — refresh ECB rates (config `importMeta: { source: 'ECB', job: 'fx:daily' }`).

- **VAT**
  - `POST /internal/cron/import/vat/auto` — OECD/IMF merge and import.

- **Duties**
  - `POST /internal/cron/import/duties/uk-mfn`
  - `POST /internal/cron/import/duties/uk-fta`
  - `POST /internal/cron/import/duties/wits` (+ `/asean`, `/japan` variants)

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

- **Ops maintenance**
  - `POST /internal/cron/imports/sweep-stale` — mark stuck runs failed
  - `POST /internal/cron/imports/prune` — delete old imports/provenance

---

## Auth

- **Client APIs:** `x-api-key` (row in DB), enforced by `plugins/api-key-auth.ts`.
- **Admin /cron:** `x-admin-token` must match `ADMIN_TOKEN`.
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
  - `src/lib/run-lock.test.ts`
  - `src/lib/sweep-stale.test.ts`
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

---

## License

MIT — see root `LICENSE`.
