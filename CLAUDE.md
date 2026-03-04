# CLAUDE.md — ClearCost

## Project overview

ClearCost is a **landed-cost / duty / VAT / freight pricing engine** — a pre-release SaaS API that computes all-in import costs for cross-border commerce.

**Stack:** TypeScript (strict, ES2022, NodeNext) · Fastify v5 · Next.js v16 · Bun · Drizzle ORM · PostgreSQL 17 · Zod · Turborepo

## Monorepo structure

```
apps/
  api/       — Fastify API (primary backend)
  web/       — Next.js admin/customer dashboard
  docs/      — Next.js public docs + playground
packages/
  db/        — @clearcost/db: Drizzle schema + migrations (source of truth for persistence)
  types/     — @clearcost/types: Zod schemas + TS types (source of truth for contracts)
  sdk/       — @clearcost/sdk: TypeScript client SDK
  widget/    — @clearcost/widget: embeddable JS widget
  ui/        — @clearcost/ui: shared React component library
  eslint-config/
  typescript-config/
ops/         — Prometheus, Grafana, runbooks
scripts/     — Root-level utility scripts
```

**Package manager:** Bun (`bun@1.3.8`, pinned in `package.json`). Lock file is `bun.lock`.

**Workspaces:** `apps/*` and `packages/*` — internal refs use `"workspace:*"`.

## Common commands

```bash
bun install                      # install deps
bun run dev                      # start all apps in dev mode (turbo)
bun run build                    # build everything (turbo)
bun run build:runtime-packages   # build db, types, sdk only
bun run lint                     # eslint across all workspaces
bun run lint:fix                 # eslint --fix
bun run format                   # prettier --write
bun run check-types              # tsc --noEmit across all workspaces
bun run test                     # vitest via turbo (all workspaces)
bun run test:coverage            # build runtime packages then vitest --coverage
bun run test:watch               # vitest watch mode
```

**Per-workspace:** `cd apps/api && bun run test` works for focused runs.

**Validation scripts (run in CI):**

- `bun run validate-envs` — env vars declared in `turbo.json`
- `bun run validate-tests` — test file naming conventions
- `bun run validate-docs` — docs wiring
- `bun run validate-duty-jobs` — duty job route/cron alignment
- `bun run validate-source-keys` — task/cron source key consistency

## Testing

- **Framework:** Vitest v4, configured at root `vitest.config.ts`
- **Naming:** `*.unit.test.ts` for unit tests, `*.int.test.ts` for integration tests
- **Coverage:** v8 provider, thresholds: 80% lines/functions/statements, 70% branches
- **Coverage reporters:** text + lcov (uploaded to Codecov)

## Code style and linting

- **Formatter:** Prettier — single quotes, trailing commas (es5), 100 char width, semicolons
- **Linter:** ESLint v9 flat config — shared config in `packages/eslint-config` with `base`, `next-js`, `react-internal` presets. `--max-warnings 0`
- **Commits:** Conventional commits enforced via `commitlint` (`@commitlint/config-conventional`)
- **Type-checking:** `tsc --noEmit` per workspace

## Git hooks (Husky)

- **pre-commit:** format, lint:fix, check-types, test:ci
- **pre-push:** build

## Architecture principles

1. **Single source of truth** — DB structure in `@clearcost/db`, request/response contracts in `@clearcost/types`. No ad-hoc inlined Zod schemas for public contracts.
2. **Clear boundaries** — Routes → services → `@clearcost/db`. Shared business logic in service modules, not copy-pasted. Web app only accesses DB directly for auth/session (Better Auth).
3. **Explicit contracts** — Every public API route has Zod input + output schemas, defined or re-exported from `@clearcost/types`.
4. **Pre-release: no backwards-compat shims** — Clean breaking improvements over compatibility layers.
5. **API-first** — All data flows through the Fastify API. Web/docs proxy to it.

## Key files

- `apps/api/src/server.ts` — `buildPublicServer()` and `buildInternalServer()` factories
- `apps/api/src/main.ts` — entry point
- `apps/api/src/modules/` — route modules grouped by domain
- `apps/api/src/lib/cron/commands/` — CLI import commands
- `apps/api/src/plugins/` — Fastify plugins (auth, usage, metrics, error handler)
- `packages/db/src/schemas/` — one file per entity
- `packages/types/src/` — Zod schemas + TS types
- `turbo.json` — pipeline config + full env var list for cache invalidation
- `docker-compose.yml` — PostgreSQL 17 + Adminer for local dev

## CI/CD

Pipeline chain: **CI** (PRs/pushes) → **Release Gate** (main) → **Staging Smoke** → **Release** (changeset version bump)

- `ci.yml` — lint, check-types, test, build (parallel)
- `release-gate.yml` — enforces PR-origin, validates envs, targeted core API tests
- `staging-smoke.yml` — `bun run smoke:staging` against staging
- `release.yml` — `changeset version` + commit + push
- `cron-*.yml` — scheduled import workflows (daily/hourly/weekly)

## Local development

```bash
docker compose up -d             # start PostgreSQL + Adminer
bun install
bun run build:runtime-packages   # build shared packages first
bun run dev                      # start all apps
```

## Environment variables

Env vars are read via `process.env.*` and managed with `@dotenvx/dotenvx`. All build-affecting vars must be declared in `turbo.json`'s env list. Never expose server-only secrets to public clients.
