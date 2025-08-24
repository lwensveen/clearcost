# ClearCost

**Developer‑first landed cost API.** Transparent duties, tariffs, VAT/GST and fees — priced for startups and
pooling‑friendly.

> Stack: Turborepo • TypeScript • Next.js • Node.js • Bun • Zod • Drizzle ORM • PostgreSQL

---

## What is ClearCost?

ClearCost is a standalone service (and SDK) that returns **all‑in landed cost quotes** at checkout time. Give it:origin,
destination, item value, dimensions/weight, and category → get back: **freight share, duty, VAT, fees, and total**, with
a **small variance guardrail** for real‑world accuracy.

* **Pooling‑native**: supports per‑manifest/container pricing and multi‑consignee workflows.
* **Cheap & predictable**: per‑API or per‑manifest pricing (no \$2 + 10% per parcel).
* **Own your data**: Postgres tables you can tune; no vendor lock‑in.

---

## Monorepo Layout (Turborepo)

```
clearcost/
  apps/
    api/              # Node.js (Fastify/Express) REST API
    docs/             # Next.js docs site (or dashboard)
  packages/
    db/               # Drizzle ORM schema + migrations
    sdk/              # TypeScript client SDK
    config/           # ESLint, TSConfig, Prettier shared
    utils/            # shared calc + zod schemas
  .github/
  turbo.json
```

---

## Quickstart

1. **Clone & install**

   ```bash
   bun install
   ```
2. **Environment**
   Create `apps/api/.env` and `packages/db/.env`:

   ```bash
   # apps/api/.env
   NODE_ENV=development
   PORT=4000
   DATABASE_URL=postgres://user:pass@localhost:5432/clearcost
   CURRENCY_BASE=USD
   VARIANCE_UNDERWRITE_BPS=50     # we absorb first 0.5% under-quote
   VARIANCE_GUARDRAIL_BPS=200     # +/- 2% guardrail on quotes

   # packages/db/.env
   DATABASE_URL=postgres://user:pass@localhost:5432/clearcost
   ```
3. **Run Postgres** (example)

   ```bash
   docker run --name clearcost-pg -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=clearcost -p 5432:5432 -d postgres:16
   ```
4. **Migrate & seed**

   ```bash
   bun run --cwd packages/db migrate
   bun run --cwd packages/db seed
   ```
5. **Dev servers**

   ```bash
   bunx turbo run dev        # runs API and docs in parallel
   ```

> Use **Bun** as the package manager. If you prefer npm or pnpm, adjust `turbo.json` scripts accordingly.

---

## Database (Drizzle + PostgreSQL)

**Initial tables** (minimal, extend later):

* `hs_codes` — `{ id, hs6, title, ahtn8?, cn8?, hts10? }`
* `categories` — `{ id, key, default_hs6 }` (maps UI categories → HS6)
* `duty_rates` — `{ id, dest, hs6, rate_pct, rule }`
* `vat_rules` — `{ id, dest, rate_pct, base }`  // base ∈ {CIF, CIF\_PLUS\_DUTY}
* `de_minimis` — `{ id, dest, currency, value, applies_to }` // applies\_to ∈ {DUTY, DUTY\_VAT, NONE}
* `freight_rates` — `{ id, origin, dest, mode, unit, breakpoint, price }` // mode ∈ {air, sea}; unit ∈ {kg, m3}
* `surcharges` — `{ id, dest, code, fixed_amt?, pct_amt?, rule_expr? }`
* `audit_quotes` — store input/output & drift for continuous tuning

> Start with **HS6** + a small curated set of codes for your first lanes. Add AHTN8/CN8/HTS10 per lane when drift
> demands it.

---

## Calculation Model (MVP)

**Inputs (required):** origin, destination, value (amount+currency), dimensions (L×W×H), weight, category (→ HS6),
optional user HS6.

**Steps:**

1. **Chargeable weight** = `max(realKg, (L*W*H)/5000)` (air). For sea use `volumeM3 = (L*W*H)/1e6`.
2. **Freight** = lookup from `freight_rates` by lane + unit curve.
3. **CIF** = item value (in dest currency) + freight (+ optional insurance).
4. **De minimis** = if CIF ≤ threshold → waive per rule.
5. **Duty** = `duty_rate% × CIF` *(or × value where applicable)*.
6. **VAT** = `vat_rate% × (CIF + Duty)` *(or CIF)*.
7. **Fees** = small fixed/percent surcharges if enabled.
8. **Total** = `CIF + Duty + VAT + Fees`.
9. **Guardrail**: show `±2%` band; absorb first `0.5%` under‑quote.

---

## API (REST, JSON)

### `POST /v1/quote`

**Body**

```json
{
  "origin": "JP",
  "dest": "US",
  "itemValue": {
    "amount": 250,
    "currency": "USD"
  },
  "dimsCm": {
    "l": 30,
    "w": 25,
    "h": 20
  },
  "weightKg": 1.8,
  "categoryKey": "collectibles.figure",
  "userHs6": "950300"
}
```

**Response**

```json
{
  "hs6": "950300",
  "chargeableKg": 3.0,
  "freight": 12.4,
  "components": {
    "CIF": 262.4,
    "duty": 5.25,
    "vat": 17.9,
    "fees": 0.8
  },
  "total": 286.35,
  "guaranteedMax": 292.08,
  "policy": "We absorb the first 0.5% under‑quote; beyond that we true‑up post‑delivery."
}
```

### `GET /v1/hs-codes/search?query=violin`

Returns HS candidates for quick selection.

### `POST /v1/classify` *(optional)*

Accepts title/description and returns `{ hs6, confidence }` from heuristic rules (ML later).

---

## SDK (TypeScript)

```ts
import { createClient } from "@clearcost/sdk";

const cc = createClient({baseUrl: process.env.CLEARCOST_URL!, apiKey: process.env.CLEARCOST_KEY!});

const quote = await cc.quote({
    origin: "JP",
    dest: "US",
    itemValue: {amount: 250, currency: "USD"},
    dimsCm: {l: 30, w: 25, h: 20},
    weightKg: 1.8,
    categoryKey: "collectibles.figure"
});
console.log(quote.total);
```

---

## Validation & Safety (Zod)

* Zod schemas on all endpoints (reject missing dims/weight).
* Category → HS6 fallback; user HS override flagged for review.
* Unsupported SKUs blocked early (hazmat, CE/FCC, IP‑restricted).

---

## Ops Loop

* **HS Audit Queue**: low‑confidence or high‑duty items reviewed pre‑cutoff.
* **CFS re‑measure/repack**: auto‑adjust if >X% discrepancy.
* **Reconciliation**: compare broker entry vs quote; log drift per lane/HS.
* **Tuning**: edit duty/VAT/freight tables via admin UI weekly.

---

## Scripts

```bash
bunx turbo run dev
bun run --cwd packages/db migrate
bun run --cwd packages/db seed
bun run --cwd apps/api build && bun run --cwd apps/api start
```

---

## Roadmap

* v0: HS6 + US/EU/TH/JP duty & VAT, basic lanes, REST API, SDK.
* v0.1: Admin UI for tables; drift dashboard.
* v0.2: AHTN8/CN8/HTS10 per lane; FTA rules on select origins.
* v0.3: Heuristic HS classifier; quote caching; FX improvements.
* v1.0: Manifest pricing mode; SLAs; audit exports.

---

## 🤝 License

MIT — see `LICENSE`.

---

## Credits

Built by Lodewijk Wensveen. Designed for pooled, multi‑consignee cross‑border commerce.