# ClearCost Beta Release Checklist

Use this as a strict go/no-go gate before onboarding design partners.

## 1) Product Scope Freeze (must be explicit)

- [x] Supported lanes are documented (only lanes we can prove with current data/importers).
- [x] Out-of-scope items are explicit (FTA/origin qualification, restricted goods, excise, US state/local sales tax).
- [x] Quote confidence semantics are documented and match API behavior.

## 2) API Contract Stability

- [x] `/v1/quotes` request/response schema is frozen for beta.
- [x] Response includes `componentConfidence`, `overallConfidence`, `missingComponents`, and `sources`.
- [x] Error envelope is consistent across public endpoints.

## 3) Billing + Quotas (end-to-end)

- [x] Startup fails fast when required billing env vars are missing.
- [ ] Stripe checkout works in test mode.
- [ ] Stripe webhook updates billing account/plan correctly.
- [x] Plan limits are enforced for compute/usage paths.

## 4) Data Freshness + Import Reliability

- [x] Import jobs run successfully on schedule for MVP datasets.
- [x] CLI and HTTP import paths use lock/provenance discipline (no duplicate concurrent runs).
- [x] Stale-data threshold is defined per dataset (for alerts and incident response).

## 5) Security / Access Boundaries

- [x] Public server does not expose internal-only routes.
- [x] Internal routes require internal signing in production.
- [x] Secrets are server-only and not exposed to web client bundles.

## 6) Observability + Ops

- [ ] Internal health and metrics endpoints are reachable from ops network.
- [x] Logs include request ids and import failures with enough context to triage.
- [x] Runbook exists for: failed imports, stale datasets, Stripe webhook failures.

## 7) CI Release Gates

- [x] `bun run lint` passes.
- [x] `bun run check-types` passes.
- [x] `bun run build` passes.
- [x] Targeted API tests pass (quotes, boundaries, cron/runtime, billing/webhook paths).

## 8) Customer Onboarding Readiness

- [x] Docs include quickstart: create key -> call quote -> interpret confidence.
- [ ] Example integration snippet is tested and copy-pasteable.
- [ ] Support response policy exists for low-confidence/missing-component quotes.

## Notes

- Remaining unchecked items in sections 1-7 are external environment/operator checks and should be completed on staging before go-live.

## Go/No-Go Rule

Release only when all items in sections 1-7 are checked.
Section 8 may have minor copy polish pending, but core onboarding must be usable.
