# ClearCost

**Developer‑first landed cost API.** Transparent duties, tariffs, VAT/GST and fees — priced for startups and
pooling‑friendly.

> Stack: Turborepo • TypeScript • Fastify • Bun • Zod • Drizzle ORM • PostgreSQL • Prometheus

---

## What is ClearCost?

ClearCost is a standalone service (and TypeScript SDK, later) that returns **all‑in landed cost quotes** at checkout
time. You post: **origin, destination, item value, dimensions/weight, category/HS hint** → you get back: **freight
share, duty, VAT/GST, surcharges, and total**, plus a **variance guardrail** to absorb small under‑quotes.

- **Pooling‑native**: supports per‑manifest/container pricing and multi‑consignee workflows.
- **Cheap & predictable**: per‑API or per‑manifest pricing (no \$2 + 10% per parcel).
- **Own your data**: Postgres tables you can tune; no lock‑in.

---

## Monorepo layout (Turborepo)

```
clearcost/
  apps/
    api/                       # Fastify API service
      src/
        lib/                   # cron runtime, provenance, metrics, locks, etc.
          cron/
            commands/          # CLI commands (imports, fx, sweep, prune)
          refresh-fx.ts
          provenance.ts
          run-lock.ts
          sweep-stale-imports.ts
        modules/
          quotes/              # /v1/quotes (landed cost)
          hs-codes/            # HS6 + alias importers (AHTN8, HTS10, UK10)
          duty-rates/          # WITS, UK, EU, US importers
          surcharges/          # US/EU/UK surcharges + helpers
          vat/                 # VAT importers (OECD/IMF)
          tasks/               # Internal cron HTTP routes
          health/              # /healthz and import health
          webhooks/            # outbound hooks (skeleton)
        plugins/
          prometheus/          # http metrics, imports-running gauges
          api-key-auth.ts
          api-usage.ts
          import-instrumentation.ts
      types/                   # Fastify module augmentations
    docs/                      # Next.js docs site (skeleton)
    web/                       # Web app placeholder

  packages/
    db/                        # Drizzle schema & migrations
      src/schemas/
        imports.ts             # import runs (provenance headers)
        provenance.ts          # per-row provenance
        hs-codes.ts            # canonical HS6 titles
        hs-code-aliases.ts     # AHTN8/HTS10/UK10 aliases
        duty-rates.ts
        surcharges.ts
        vat.ts
        ...
    types/                     # Shared Zod/TS types

  ops/
    prometheus/prometheus.yml  # local scrape config
    grafana/dashboards/        # JSON dashboards (imports, http)

  .github/workflows/
    cron-hourly.yml            # stale sweep
    cron-nightly.yml           # daily imports
    cron-weekly.yml            # weekly deep jobs + prune
    api-tests.yml              # CI tests for API
```

---

## What’s already built

- **Quote API** — `/v1/quotes` with idempotency, auditing, Zod validation.
  - Paths: `apps/api/src/modules/quotes/routes.ts` + `.../services/quote-landed-cost.ts`

- **Data import pipelines** with provenance + metrics:
  - **FX (ECB)**: `POST /internal/cron/fx/daily` → `lib/refresh-fx.ts`
  - **VAT (OECD/IMF)**: `POST /internal/cron/import/vat/auto`
  - **Duties**: WITS/UK/EU/US importers (streaming + batch upsert)
  - **Surcharges**: US 301/232, MPF/HMF, EU/UK trade remedies
  - **HS codes**: TARIC HS6 titles; AHTN8/HTS10/UK10 aliases
  - All task routes live under `apps/api/src/modules/tasks/**` and are instrumented via
    `plugins/import-instrumentation.ts`.

- **Provenance store** (import runs + per-row provenance)
  - Schema: `packages/db/src/schemas/imports.ts`, `.../provenance.ts`
  - Plugin: `apps/api/src/plugins/import-instrumentation.ts` (sets up timers, heartbeats, metrics; auto-closes on
    error/finish)

- **Locks & Sweeping**
  - Run‑lock helper: `apps/api/src/lib/run-lock.ts` (pg_advisory lock wrapper)
  - Stale sweep util + HTTP route: `lib/sweep-stale-imports.ts`, `modules/tasks/sweep-stale-routes.ts`
  - Prune old imports/provenance: CLI command + HTTP route

- **Observability**
  - Prometheus HTTP metrics: `plugins/prometheus/metrics-http.ts` → `/metrics`
  - Import‑focused gauges: `plugins/prometheus/imports-running.ts`, `imports-extra.ts`
  - Example Prom scrape config: `ops/prometheus/prometheus.yml`

- **Auth & metering**
  - API key auth + scoped guards: `plugins/api-key-auth.ts`
  - Per‑key usage aggregation: `plugins/api-usage.ts` (writes to `api_usage`)

- **Cron runners**
  - **HTTP cron** via GitHub Actions: `cron-hourly.yml`, `cron-nightly.yml`, `cron-weekly.yml`
  - **CLI cron** for manual/dev: `apps/api/src/lib/cron/runtime.ts` with commands in `lib/cron/commands/*`

- **Tests & CI**
  - Basic unit tests: `apps/api/src/lib/run-lock.test.ts`, `.../sweep-stale.test.ts`
  - CI: `.github/workflows/api-tests.yml`

---

## What’s left for the MVP

**Backend**

- [ ] Quote engine hardening (edge lanes; volumetric rules for sea; insurance option)
- [ ] De‑minimis table & rules per destination
- [ ] More surcharges & remedy carve‑outs (e.g., US 232 country exceptions)
- [ ] Better error mapping → 4xx vs 5xx; consistent error schema
- [ ] Cache layers (FX, WITS responses) + request timeout envelopes

**Data quality & ops**

- [ ] Drift monitor: compare broker entries vs quoted totals per HS/lane
- [ ] Simple admin endpoints to patch duties/VAT/freight rows
- [ ] One‑shot backfills (commands + docs)

**Docs & SDK**

- [ ] Expand docs site with guides and schema reference
- [ ] Publish minimal TypeScript SDK (`packages/types` exists; SDK package TBD)

**Security**

- [ ] Rotate keys; rate limiting profiles; audit trails

---

## Quickstart (local)

1. **Install deps**

```bash
bun install
```

2. **Run Postgres** (example)

```bash
docker run --name clearcost-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=clearcost -p 5432:5432 -d postgres:16
```

3. **Environment**

Create `apps/api/.env` and `packages/db/.env` minimally:

```ini
# apps/api/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/clearcost
PORT=4000
NODE_ENV=development

# packages/db/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/clearcost
```

4. **Migrate**

```bash
bun run --cwd packages/db migrate
```

5. **Dev**

```bash
bunx turbo run dev
# or: bun run --cwd apps/api dev
```

---

## Running imports

### Via HTTP routes (admin key required)

```bash
# FX (ECB)
curl -X POST -H "x-admin-token: $ADMIN" \
  "${API%/}/internal/cron/fx/daily"

# VAT (OECD/IMF)
curl -X POST -H "x-admin-token: $ADMIN" \
  "${API%/}/internal/cron/import/vat/auto"

# US surcharges (all)
curl -X POST -H "x-admin-token: $ADMIN" -H 'content-type: application/json' \
  -d '{"batchSize":5000}' \
  "${API%/}/internal/cron/import/surcharges/us-all"
```

### Via CLI (local/manual)

```bash
cd apps/api
bun run src/lib/cron/runtime.ts fx:refresh
bun run src/lib/cron/runtime.ts import:vat
bun run src/lib/cron/runtime.ts imports:sweep-stale --threshold 30
bun run src/lib/cron/runtime.ts imports:prune --days 90
```

Commands are registered in `apps/api/src/lib/cron/registry.ts`.

---

## Observability

- **Prometheus**: scrape `${API}/metrics` (see `ops/prometheus/prometheus.yml`).
- Gauges & histograms:
  - `http_server_request_duration_seconds`
  - `http_server_requests_total`
  - `clearcost_import_last_run_timestamp{import_id}`
  - `clearcost_imports_running{age_bucket}` (if enabled)

---

## API overview

- `POST /v1/quotes` — compute landed cost (idempotent; requires `quotes:write` scope)
- `GET /v1/quotes/by-key/:key` — replay cached quote (requires `quotes:read`)
- `GET /healthz` / `HEAD /healthz` — liveness & readiness
- `GET /health/imports` — import activity snapshot (for dashboards)
- `/internal/cron/**` — admin/protected import tasks

Auth helpers and scopes live in `apps/api/src/plugins/api-key-auth.ts`.

---

## Development tips

- Type augmentations for Fastify are in `apps/api/types/import-instrumentation.d.ts`.
- Import routes can opt‑in to provenance + metrics by setting `config.importMeta`:

```ts
app.post(
  '/internal/cron/…',
  {
    preHandler: adminGuard,
    config: { importMeta: { source: 'USITC_HTS', job: 'duties:us-mfn' } },
  },
  handler
);
```

The `import-instrumentation` plugin starts timers, creates the import run, heartbeats during work, and auto‑finishes (
success/failure) based on the response.

---

## Testing & CI

- **Local**: `bun test` (see `apps/api/tsconfig.test.json`)
- **CI**: `.github/workflows/api-tests.yml`

---

## License

MIT — see `LICENSE`.

---

## Credits

Built by Lodewijk Wensveen — designed for pooled, multi‑consignee cross‑border commerce.
