# Staging Smoke Runbook

Use this runbook when `.github/workflows/staging-smoke.yml` fails.

## 1) Locate the failing check

1. Open the failed workflow run in GitHub Actions.
2. Download the artifact named `staging-smoke-report-<run_id>`.
3. Inspect `results[]` in `staging-smoke-report.json` and identify checks with `"ok": false`.

## 2) Triage by failure type

### `public quote computes`

- Verify `STAGING_PUBLIC_API_URL` is reachable.
- Verify `STAGING_PUBLIC_API_KEY` exists and has `quotes:write`.
- Check API logs for `/v1/quotes` validation/auth failures.

### `billing plan` / `billing entitlements` / `billing compute usage`

- Verify `STAGING_BILLING_API_KEY` (or fallback `STAGING_PUBLIC_API_KEY`) has `billing:read`.
- Confirm billing env on API is valid (`STRIPE_*` and price IDs).
- Check `/v1/billing/*` route logs for auth/stripe/env errors.

### `internal healthz`

- Verify `STAGING_INTERNAL_API_URL` points to the internal server.
- Confirm `/internal/healthz` is reachable from Actions network path.

### `metrics rejects anonymous`

- If this unexpectedly passes, verify `/metrics` protection config and API-key prehandler.

### `metrics accepts ops key (signed when required)`

- Verify `STAGING_OPS_API_KEY` exists and has `ops:metrics`.
- If `METRICS_REQUIRE_SIGNING=1`, verify `STAGING_INTERNAL_SIGNING_SECRET` matches API.
- Confirm `/metrics` is exposed on the internal server only.

## 3) Fast rollback guard

If failures are due to new deploy behavior and block partner onboarding:

1. Roll back to the last green deployment.
2. Re-run `Staging Smoke` manually.
3. Keep release blocked until all checks return green.

## 4) Exit criteria

- A new `Staging Smoke` run is green.
- Root cause + fix are noted in the deploy PR description.
