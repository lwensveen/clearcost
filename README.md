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
          duty-rates/          # WITS, UK, EU, US + LLM importers
          surcharges/          # US/EU/UK surcharges + LLM importers
          vat/                 # VAT importers (OECD/IMF) + LLM importers
          tasks/               # Internal cron HTTP routes (scoped)
          health/              # /healthz and import health
          webhooks/            # Outbound webhooks (admin + dispatcher)
        plugins/
          prometheus/          # http metrics, imports-running gauges
          api-key-auth.ts
          api-usage.ts
          import-instrumentation.ts
      types/                   # Fastify module augmentations
    web/                       # Internal/admin UI + customer dashboard (Next.js)
    docs/                      # Public docs + playground (Next.js)
    widget/                    # Embeddable JS widget bundle

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
    release-gate.yml           # required release checks (env/lint/types/build/core API tests)
    staging-smoke.yml          # staging endpoint smoke checks + report artifact
    ci.yml                     # full monorepo checks
    api-tests.yml              # API-focused checks
    cron-*.yml                 # scheduled import workflows
```

---

## What’s already built

- **Quote API** — `/v1/quotes` with idempotency, auditing, Zod validation.
  - Code: `apps/api/src/modules/quotes/routes.ts` → `services/quote-landed-cost.ts`

- **Data import pipelines** with provenance + metrics:
  - **FX (ECB)** → `POST /internal/cron/fx/daily`
  - **VAT (OECD/IMF)** → `POST /internal/cron/import/vat/auto`
  - **Duties** → WITS/UK/EU/US importers + **LLM-assisted importers (OpenAI, Grok, cross‑check)**
  - **Surcharges** → US 301/232 + MPF/HMF; EU/UK trade remedies + **LLM importers**
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

# Optional (LLM importers)
OPENAI_API_KEY=...
XAI_API_KEY=...         # or GROK_API_KEY
OPENAI_MODEL=gpt-4o-mini
GROK_MODEL=grok-2-latest

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

## Environment (by app)

These are the **minimum** env vars to boot each app locally. Feature‑specific vars (imports, Stripe, LLMs) are listed in
`apps/api/README.md`.

### Notes for clients and runtime envs

- **API error envelope**: all error responses should be shaped as
  `{ error: { code: string; message: string; details?: unknown } }`.
- **Client parsing**: use `extractErrorMessage(...)` (see `apps/web/lib/errors.ts`) instead of reading `json.error`
  directly so both string and object errors are handled safely.
- **Env helpers (apps/web)**: `requireEnv` is build‑safe in non‑prod; `requireEnvStrict` always throws.
  Use `requireEnvStrict` only inside lazy/runtime helpers like `getAuth()`/`getDb()` and `getAdminEnv()`.
- **Internal ops flags**: `ALLOW_INTERNAL_BIND=1` permits internal server public bind in production (logs a warning).
  `/metrics` requires internal signing by default in production; set `METRICS_REQUIRE_SIGNING=0` to opt out.

**API (`apps/api`)**

- Required: `DATABASE_URL`, `API_KEY_PEPPER`, `INTERNAL_SIGNING_SECRET`, `CLEARCOST_API_URL`
- Ops/CI: `CLEARCOST_INTERNAL_API_URL`
- Common: `WEB_ORIGIN` (CORS), `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `INTERNAL_PORT`, `INTERNAL_HOST`, `TRUST_PROXY`
- Deployment guardrails: `ALLOW_INTERNAL_BIND=1` to permit public bind for internal server in production
- Feature flags: `STRIPE_*`, `WEBHOOK_KMS_KEY`, `OXR_APP_ID`, `OPENAI_API_KEY`/`GROK_API_KEY`

**Web (`apps/web`)**

- Required: `DATABASE_URL`, `CLEARCOST_API_URL`, `CLEARCOST_WEB_SERVER_KEY`
- Admin screens: `CLEARCOST_ADMIN_API_KEY`
- Auth/session: `REDIS_URL`, `REDIS_TOKEN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_COOKIE_DOMAIN` (optional), `API_URL`, `EMAIL_OTP_API_SECRET`, `TURNSTILE_SECRET_KEY`

**Docs (`apps/docs`)**

- Required: `CLEARCOST_API_URL`, `CLEARCOST_WEB_SERVER_KEY`

---

## API overview

### Deployment/runtime topology

The API runs **two Fastify servers**:

- **Public server**: `HOST` + `PORT` (default `0.0.0.0:3001`)
- **Internal server**: `INTERNAL_HOST` + `INTERNAL_PORT` (default `0.0.0.0:3002`)

Public APIs and admin surfaces live on the public server. Ops/internal routes (metrics, import health, cron, notices)
live on the internal server and require internal request signing in production.

### Public/Customer APIs

- `POST /v1/quotes` — compute landed cost (**requires scope:** `quotes:write`)
- `GET /v1/quotes/by-key/:key` — replay cached quote (**requires:** `quotes:read`)
- `GET /healthz` / `HEAD /healthz` — liveness & readiness
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

### Ops / Admin-only (internal server)

Hosted on the internal server (`INTERNAL_PORT`, default 3002). Access should be restricted by network ACLs.

- `GET /metrics` — Prometheus metrics (**requires scope:** `ops:metrics` in `x-api-key`; internal signing is required by default in production, disable with `METRICS_REQUIRE_SIGNING=0`)
- `GET /v1/admin/health/imports` — import activity snapshot (**requires scope:** `ops:health`)
- `GET /internal/healthz` — internal health check (no signature)

### Internal cron routes (scoped)

Mounted under `/internal/cron/**` on the internal server (`INTERNAL_PORT`) and **require an API key**
with the specific `tasks:*` scope. In production, internal requests must also include `x-cc-ts` + `x-cc-sig`
signatures. Highlights (not exhaustive):

```
# FX
POST /internal/cron/fx/daily                           (tasks:fx:daily)

# VAT
POST /internal/cron/import/vat/auto                    (tasks:vat:auto)

# Duties
POST /internal/cron/import/duties/uk-mfn               (tasks:duties:uk)
POST /internal/cron/import/duties/uk-fta               (tasks:duties:uk)
POST /internal/cron/import/duties/eu-mfn               (tasks:duties:eu)
POST /internal/cron/import/duties/eu-fta               (tasks:duties:eu)
POST /internal/cron/import/duties/us-mfn               (tasks:duties:us:mfn)
POST /internal/cron/import/duties/us-preferential      (tasks:duties:us:fta)
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
POST /internal/cron/de-minimis/seed-baseline            (tasks:de-minimis:seed-baseline)

# Notices (internal ops)
GET /internal/notices                                   (tasks:notices)
GET /internal/notices/:id                               (tasks:notices)
```

> Some legacy routes may still accept an **admin token**; prefer scoped API keys going forward.

**Internal ops client (recommended)**

Use the shared signer client to call internal routes from CI/ops:

```bash
export CLEARCOST_INTERNAL_API_URL="https://internal.clearcost.example"
export CLEARCOST_TASKS_API_KEY="ck_..."
export INTERNAL_SIGNING_SECRET="..."

bun run internal-request -- --path /internal/cron/fx/daily --body '{}'
```

---

## LLM importers (OpenAI, Grok) & cross‑check

LLM importers fetch structured JSON (schemas + prompts live under each module’s `services/llm/**`). We reconcile outputs
across models when desired, preferentially selecting **officially‑sourced** rows.

### CLI commands

```bash
# Duties
bun run src/lib/cron/index.ts import:duties:llm-openai   -- --model gpt-4o-mini --prompt "..."
bun run src/lib/cron/index.ts import:duties:llm-grok     -- --model grok-2-latest --prompt "..."
bun run src/lib/cron/index.ts import:duties:llm-crosscheck -- --mode prefer_official

# Surcharges
bun run src/lib/cron/index.ts import:surcharges:llm-openai   -- --model gpt-4o-mini --prompt "..."
bum run src/lib/cron/index.ts import:surcharges:llm-grok     -- --model grok-2-latest --prompt "..."
bun run src/lib/cron/index.ts import:surcharges:llm-crosscheck -- --mode prefer_official

# VAT
bun run src/lib/cron/index.ts import:vat:llm-openai   -- --model gpt-4o-mini --prompt "..."
bun run src/lib/cron/index.ts import:vat:llm-grok     -- --model grok-2-latest --prompt "..."
bun run src/lib/cron/index.ts import:vat:llm-crosscheck -- --mode prefer_official
```

### Env vars

- `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `XAI_API_KEY` (or `GROK_API_KEY`), optional `GROK_MODEL` (default: `grok-2-latest`)

### Accuracy & provenance

- Each row must include a `source_url`; provenance attaches it to stored rows.
- Cross‑check compares amounts and structure; if sources disagree, we prefer **official** and flag conflicts.

---

## Idempotency

ClearCost endpoints that create/import data use **idempotency keys**.

- Send `Idempotency-Key` (or `X-Idempotency-Key`) on POSTs.
- If the same key is reused with a **different payload**, you’ll get a **409**.
- Replays return the prior response (handlers may refresh if stale).

Internals are implemented in `apps/api/src/lib/idempotency.ts`.

---

## Webhooks (admin)

Admin endpoints allow managing webhook endpoints; secrets are stored **encrypted at rest** (plaintext never persisted).

- `POST /v1/admin/webhooks/endpoints` _(admin scope)_ → returns `secret` **once**
- `POST /v1/admin/webhooks/endpoints/:id/rotate` → returns new `secret` **once**
- `PATCH /v1/admin/webhooks/endpoints/:id` → activate/deactivate
- `GET /v1/admin/webhooks/deliveries?endpointId=…` → recent deliveries

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
bun run src/lib/run-cron.ts fx:refresh
bun run src/lib/run-cron.ts import:vat
bun run src/lib/run-cron.ts import:sweep-stale --threshold 30
bun run src/lib/run-cron.ts import:prune --days 90
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
- **Release gate**: `.github/workflows/release-gate.yml`
- **Staging smoke**: `.github/workflows/staging-smoke.yml`
  - Required secrets: `STAGING_PUBLIC_API_URL`, `STAGING_INTERNAL_API_URL`, `STAGING_PUBLIC_API_KEY`, `STAGING_OPS_API_KEY`
  - Optional secrets: `STAGING_BILLING_API_KEY`, `STAGING_BILLING_WRITE_API_KEY`, `STAGING_INTERNAL_SIGNING_SECRET`
  - Failure runbook: `ops/runbooks/staging-smoke.md`
- **Billing readiness runbook**: `ops/runbooks/billing-readiness.md`
- **Data freshness runbook**: `ops/runbooks/data-freshness.md`

### Release TODO

- [ ] Enable branch protection on `main` and require `Release Gate`.
- [ ] Create `staging` environment secrets used by `staging-smoke.yml`.
- [ ] Run one manual `Staging Smoke` workflow and verify artifact output.
- [ ] Run billing readiness flow in Stripe test mode (`ops/runbooks/billing-readiness.md`).
- [ ] Confirm data freshness thresholds and alert handling (`ops/runbooks/data-freshness.md`).

---

## License

MIT — see `LICENSE`.

---

## Credits

Built by Lodewijk Wensveen — designed for pooled, multi‑consignee cross‑border commerce.
