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
          tasks/               # Internal cron HTTP routes (scoped)
          health/              # /healthz and import health
          webhooks/            # Outbound webhooks (admin + dispatcher)
        plugins/
          prometheus/          # http metrics, imports-running gauges
          api-key-auth.ts
          api-usage.ts
          import-instrumentation.ts
      types/                   # Fastify module augmentations

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
        webhooks.ts
        auth/api-keys.ts
    types/                     # Shared Zod/TS types

  ops/
    prometheus/prometheus.yml  # local scrape config

  .github/workflows/
    cron-hourly.yml            # stale sweep
    cron-nightly.yml           # daily imports
    cron-weekly.yml            # weekly deep jobs + prune
    api-tests.yml              # CI tests for API
```

---

## What’s already built

- **Quote API** — `/v1/quotes` with idempotency, auditing, Zod validation.
  - Code: `apps/api/src/modules/quotes/routes.ts` → `services/quote-landed-cost.ts`

- **Data import pipelines** with provenance + metrics:
  - **FX (ECB)** → `POST /internal/cron/fx/daily`
  - **VAT (OECD/IMF)** → `POST /internal/cron/import/vat/auto`
  - **Duties** → WITS/UK/EU/US importers
  - **Surcharges** → US 301/232 + MPF/HMF; EU/UK trade remedies
  - **HS** → TARIC HS6 titles; AHTN8/HTS10/UK10 aliases
  - Task routes live in `apps/api/src/modules/tasks/**` and are instrumented by `plugins/import-instrumentation.ts`.

- **Provenance store** (import runs + per-row provenance)
- **Locks & Sweeping** (`run-lock.ts`, `sweep-stale-imports.ts`)
- **Observability**: Prometheus `/metrics` + import gauges
- **Auth & metering**: API key auth (`plugins/api-key-auth.ts`) + per-key usage (`api-usage.ts`)
- **Cron runners**: HTTP via GitHub Actions; local CLI commands

---

## Quickstart (local)

1. **Install deps**

```bash
bun install
```

2. **Run Postgres**

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

## API overview

### Public/Customer APIs

- `POST /v1/quotes` — compute landed cost (**requires scope:** `quotes:write`)
- `GET /v1/quotes/by-key/:key` — replay cached quote (**requires:** `quotes:read`)
- `GET /healthz` / `HEAD /healthz` — liveness & readiness
- `GET /health/imports` — import activity snapshot
- `GET /metrics` — Prometheus metrics
- `GET /v1/hs-codes` — HS6 search/lookup (**requires:** `hs:read`)
- `GET /v1/hs-codes/lookup` — alias→HS6 (**requires:** `hs:read`)

### Admin / Key management

- `GET /v1/api-keys/self` — introspect current key
- `POST /v1/api-keys/self/rotate` — rotate (returns plaintext once)
- `POST /v1/api-keys/self/revoke` — revoke current key
- `GET /v1/admin/api-keys?ownerId=…` — list
- `POST /v1/admin/api-keys` — create (returns plaintext once)
- `PATCH /v1/admin/api-keys/:id` — patch/revoke/reactivate
- `POST /v1/admin/api-keys/:id/rotate` — admin rotate (plaintext once)

### Internal cron routes (scoped)

All mounted under `/internal/cron/**` and **require an API key** with the specific `tasks:*` scope. Highlights:

```
# FX
POST /internal/cron/fx/daily                           (tasks:fx:daily)

# VAT
POST /internal/cron/import/vat/auto                    (tasks:vat:auto)

# Duties
POST /internal/cron/import/duties/uk-mfn               (tasks:duties:uk-mfn)
POST /internal/cron/import/duties/uk-fta               (tasks:duties:uk-fta)
POST /internal/cron/import/duties/eu-mfn               (tasks:duties:eu-mfn)
POST /internal/cron/import/duties/eu-fta               (tasks:duties:eu-fta)
POST /internal/cron/import/duties/us-mfn               (tasks:duties:us-mfn)
POST /internal/cron/import/duties/us-preferential      (tasks:duties:us-fta)
POST /internal/cron/import/duties/wits                 (tasks:duties:wits)
POST /internal/cron/import/duties/wits/asean           (tasks:duties:wits:asean)
POST /internal/cron/import/duties/wits/japan           (tasks:duties:wits:japan)

# Surcharges
POST /internal/cron/import/surcharges/us-trade-remedies (tasks:surcharges:us-trade-remedies)
POST /internal/cron/import/surcharges/us-all            (tasks:surcharges:us-all)
POST /internal/cron/import/surcharges                   (tasks:surcharges:json)
POST /internal/cron/import/surcharges/eu-remedies       (tasks:surcharges:eu-remedies)
POST /internal/cron/import/surcharges/uk-remedies       (tasks:surcharges:uk-remedies)

# HS aliases & titles
POST /internal/cron/import/hs/eu-hs6                    (tasks:hs:eu-hs6)
POST /internal/cron/import/hs/ahtn                      (tasks:hs:ahtn)

# De‑minimis
POST /internal/cron/de-minimis/import-zonos             (tasks:de-minimis:import-zonos)
POST /internal/cron/de-minimis/import-official          (tasks:de-minimis:import-official)

# Ops
POST /internal/cron/imports/sweep-stale                 (tasks:imports:sweep-stale)
POST /internal/cron/imports/prune                       (tasks:imports:prune)
```

> Some legacy routes may still accept an **admin token**; prefer scoped API keys going forward.

---

## Cron key scopes (copy‑paste)

Grant these scopes to the API key used by your GitHub Actions:

```
tasks:imports:sweep-stale,tasks:fx:daily,tasks:vat:auto,tasks:duties:uk-mfn,tasks:duties:uk-fta,tasks:duties:eu-mfn,tasks:duties:eu-fta,tasks:duties:us-mfn,tasks:duties:us-fta,tasks:surcharges:us-trade-remedies,tasks:surcharges:us-all,tasks:surcharges:json,tasks:freight:json,tasks:hs:eu-hs6,tasks:hs:ahtn,tasks:duties:wits,tasks:duties:wits:asean,tasks:duties:wits:japan,tasks:surcharges:eu-remedies,tasks:surcharges:uk-remedies,tasks:de-minimis:import-zonos,tasks:de-minimis:import-official,tasks:imports:prune
```

Set it in your repository secrets/vars (see `cron-nightly.yml` and `cron-weekly.yml`).

---

## Idempotency

ClearCost endpoints that create/import data use **idempotency keys**.

- Send `Idempotency-Key` (or `X-Idempotency-Key`) on POSTs.
- If the same key is reused with a **different payload**, you’ll get a **409**.
- Replays return the prior response (handlers may refresh if stale).

Internals are implemented in `apps/api/src/lib/idempotency.ts`.

---

## Webhooks (admin)

Admin endpoints allow managing webhook endpoints; secrets are stored as **salted hashes** (no plaintext persistence).

- `POST /v1/webhooks/endpoints` _(admin scope)_ → returns `secret` **once**
- `POST /v1/webhooks/endpoints/:id/rotate` → returns new `secret` **once**
- `PATCH /v1/webhooks/endpoints/:id` → activate/deactivate
- `GET /v1/webhooks/deliveries?endpointId=…` → recent deliveries

**Signature**: requests include `clearcost-signature: t=<unix>,v1=<hex>` where

```
v1 = sha256_hmac(secret, `${t}.${body}`)
```

Verify by recomputing the HMAC over the exact raw body and checking timestamp skew.

---

## Running imports

### Via HTTP routes (with scoped API key)

```bash
# FX (ECB)
curl --fail -X POST -H "x-api-key: $API_KEY" \
  "$API/internal/cron/fx/daily"

# VAT (OECD/IMF)
curl --fail -X POST -H "x-api-key: $API_KEY" \
  "$API/internal/cron/import/vat/auto"

# US surcharges (all)
curl --fail -X POST -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d '{"batchSize":5000}' \
  "$API/internal/cron/import/surcharges/us-all"
```

### Via CLI (local/dev)

```bash
cd apps/api
bun run src/lib/cron/runtime.ts fx:refresh
bun run src/lib/cron/runtime.ts import:vat
bun run src/lib/cron/runtime.ts imports:sweep-stale --threshold 30
bun run src/lib/cron/runtime.ts imports:prune --days 90
```

---

## Observability

- **Prometheus**: scrape `GET /metrics` (see `ops/prometheus/prometheus.yml`).
- Key metrics:
  - `http_server_request_duration_seconds`
  - `http_server_requests_total`
  - `clearcost_import_last_run_timestamp{import_id="…"}`
  - `clearcost_imports_running{age_bucket="…"}`

---

## Testing & CI

- **Local**: `bun test`
- **CI**: `.github/workflows/api-tests.yml`

---

## License

MIT — see `LICENSE`.

---

## Credits

Built by Lodewijk Wensveen — designed for pooled, multi‑consignee cross‑border commerce.
