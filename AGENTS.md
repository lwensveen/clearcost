# AGENTS — ClearCost

This document tells you how to work on this repo as an “agent”.

ClearCost is a **landed-cost / duty / VAT / freight pricing engine** with:

- A Fastify API in `apps/api`
- Shared libraries in `packages/*`:
  - `@clearcost/db` — Drizzle ORM & schema
  - `@clearcost/types` — Zod schemas + TypeScript types
  - `@clearcost/*` (eslint-config, tsconfig, etc.) — DX only

The **source of truth** for architecture is:

- `README.md`
- This `AGENTS.md`

Always conform to those before adding new patterns.

---

## High-level architecture

### Apps

- **API** (`apps/api`)
  - Fastify server
  - Route modules grouped by domain (pricing, quotes, importers, lookups, health, etc.)
  - Uses `@clearcost/db` for DB access
  - Uses `@clearcost/types` for request/response schemas
- **Web app** (`apps/web`)
  - Internal/admin UI + customer dashboard
  - Server actions and API routes proxy to `apps/api`
  - Uses `@clearcost/types` for shared contracts
  - Uses DB directly **only** for auth/session storage (Better Auth)
- **Docs** (`apps/docs`)
  - Public docs + playground; proxies to API using server-only keys
- **Widget** (`apps/widget`)
  - Embeddable JS widget bundle

This is still **API-first**, but there are now companion web/docs apps.

### Packages

- **`@clearcost/db`**
  - Drizzle schema + migrations
  - DB enums & constraints are canonical for persistence
- **`@clearcost/types`**
  - Zod schemas derived from `@clearcost/db` (where possible)
  - Request/response “wire” schemas for the API (JSON)
  - Shared TypeScript types for clients and API
- **Other packages** (`eslint-config`, `typescript-config`, etc.)
  - Only for tooling and DX

---

## What “good” looks like

When you change things, bias towards:

1. **Single source of truth**
   - DB structure lives in `@clearcost/db`
   - Request/response contracts live in `@clearcost/types`
   - No ad-hoc inlined Zod or TS types inside route handlers if they represent public contracts.

2. **Clear boundaries**
   - API routes talk to services; services talk to `@clearcost/db`.
   - Shared business logic (e.g. pricing, classification) lives in service modules or shared packages, not copy-pasted.
   - Direct DB access outside the API is only for `apps/web` auth/session storage.

3. **Explicit contracts**
   - Every public API route should have:
     - Zod schema for input
     - Zod schema for output
   - Those schemas should be defined or re-exported from `@clearcost/types`.

4. **Consistent auth & configuration**
   - API keys / scopes enforced consistently across routes that need protection.
   - Env vars:
     - Read via `process.env.*`
     - Declared in `turbo.json` env list if they affect build behavior.
   - Never expose server-only secrets to public clients.

5. **Pre-release: no backwards-compat shims**
   - We are **pre-release**, so you **do not** need to keep deprecated aliases or legacy types.
   - Prefer clean, breaking improvements over compatibility layers.

---

## How to work as an agent

When asked to do a **repo-wide sweep**:

1. **Rebuild architecture map**
   - Re-read `README.md` and this `AGENTS.md`.
   - Use `rg`, `ls`, and reading:
     - `apps/api/src/server.ts`
     - `apps/api/src/modules/**`
     - `packages/db/src/**`
     - `packages/types/src/**`

2. **Pass 1 — Detection (no edits)**
   - Look for **architectural or contract-level** issues:
     - Route modules not registered or mis-prefixed.
     - Auth enforcement gaps (missing API key / scope / admin check).
     - Drift between:
       - `@clearcost/db` enums/schemas
       - `@clearcost/types` Zod schemas
       - Route handlers’ input/output.
     - Duplicate business logic (pricing calculations, classification, lookups).
     - Response shapes defined inline in routes while clients define their own types instead of using `@clearcost/types`.
     - Env vars used but not declared in `turbo.json`.
     - Tooling confusion (bun vs pnpm vs turbo).
   - Output **change groups**:
     - Short name
     - Description
     - File paths
     - Impact (`high`, `medium`, `low`)

3. **Pass 2 — Plan**
   - Propose an ordered list of change groups (highest impact / lowest risk first).
   - For each group:
     - What you want to change conceptually.
     - Tradeoffs (breaking changes, tighter coupling, new deps).

   Then **stop and wait** for explicit approval before editing.

4. **Pass 3 — Apply (per approved group)**
   - For the selected group:
     1. Show a **proposed diff** (patch preview only).
     2. On approval:
        - Apply the patch.
        - Run:
          - `bun run lint`
          - `bun run check-types`
          - `bun run build`
        - Treat existing known failures (e.g. missing tests, external network/font issues) as baseline; only report **new** problems.
     3. Summarize:
        - Files changed
        - Any new warnings/errors (or confirm none).

5. **General rules**
   - Prefer **centralizing** schemas/types in `@clearcost/types`.
   - Prefer **centralizing** DB concerns in `@clearcost/db`.
   - Do **not** add backwards-compat exports or aliases; rename and update all usages instead.
   - Don’t invent tests or try to “solve” external network failures (e.g. fonts, online services) — just note them.

---

## Common operations

When doing structural work, you may:

- Run:
  - `bun run lint`
  - `bun run check-types`
  - `bun run build`
- Use:
  - `rg` to find route handlers, schema usage, and env vars.
  - `ls` and reading `server.ts` to understand module registration.

If a command fails for known, unrelated reasons (e.g. external network, missing tests), **do not** try to hack around it; instead:

- Note that it’s a known limitation.
- Only treat new errors as regressions.

---
