# Billing Readiness Runbook (Stripe test mode)

Use this runbook before release to verify the money path end-to-end.

## Preconditions

- API has billing env configured:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_GROWTH`
  - `STRIPE_PRICE_SCALE`
- You have an API key with `billing:read` and `billing:write`.
- Staging smoke secrets are set for billing checks.

## Automated check in CI

`staging-smoke.yml` runs `scripts/staging-smoke.ts` and validates:

- `GET /v1/billing/plan`
- `GET /v1/billing/entitlements`
- `GET /v1/billing/compute-usage`
- `POST /v1/billing/checkout` (expects a valid checkout session URL)

If checkout fails, treat it as a release blocker.

## Manual E2E flow (test mode)

1. Create a checkout session:
   - `POST /v1/billing/checkout` with `{ "plan": "starter" }`
2. Open returned Stripe Checkout URL and complete payment using a Stripe test card.
3. Confirm webhook delivery in Stripe dashboard for:
   - `checkout.session.completed`
   - `customer.subscription.updated` (or created)
4. Verify API reflects the subscription:
   - `GET /v1/billing/plan` shows non-`free` plan/status.
   - `GET /v1/billing/entitlements` reflects expected limits.

## Exit criteria

- Staging smoke is green (including checkout).
- One manual Stripe test checkout updates plan + entitlements correctly.
