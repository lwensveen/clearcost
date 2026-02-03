# Data Freshness & Import Failure Runbook

Use this runbook when import data looks stale or import jobs fail.

## Freshness thresholds (release defaults)

These thresholds match current cron cadence in `.github/workflows/cron-*.yml`.

| Dataset family                                                                                | Expected cadence | Alert threshold |
| --------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| FX rates (`fx:refresh`)                                                                       | Daily            | stale after 30h |
| VAT import (`import:vat`)                                                                     | Daily            | stale after 48h |
| EU duties daily (`import:duties:eu:daily`)                                                    | Daily            | stale after 48h |
| De-minimis (`import:de-minimis:*`)                                                            | Daily            | stale after 48h |
| Notices crawl (`crawl:notices*`)                                                              | Daily            | stale after 48h |
| Heavy duty/HS/surcharge imports (`import:duties:wits*`, `import:hs:*`, `import:surcharges:*`) | Weekly           | stale after 8d  |

If a critical dataset is stale beyond threshold, block release.

## How to check quickly

1. Admin import health endpoint:
   - `GET /v1/admin/health/imports?thresholdHours=48`
2. Internal metrics:
   - `clearcost_import_last_run_timestamp{import_id="..."}`
   - `clearcost_imports_running{age_bucket="..."}`

## Failure criteria

- **Critical:** no fresh run beyond threshold for FX/VAT/duties used by active lanes.
- **Warning:** non-critical importer stale, but quote path still has valid recent data.
- **Critical:** importer stuck running (sweep does not clear stale lock).

## Response steps

1. Check failing workflow (`cron-daily-http`, `cron-weekly-cli`, etc.).
2. Re-run the specific job manually.
3. If stale lock is present, run sweep (`/internal/cron/imports/sweep-stale`).
4. Confirm new run recorded in import metrics/health endpoint.
5. Log root cause and fix in the release PR.

## Exit criteria

- All release-critical datasets are within threshold.
- No importer stuck in running state.
- Next scheduled cron run succeeds.
