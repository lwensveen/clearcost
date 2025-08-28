import type { SurchargeInsert } from '@clearcost/types';

/**
 * Harbor Maintenance Fee (HMF) – 0.125% of entered value for ocean imports.
 * Values are supplied via env; we include mode guidance in notes until a `mode`
 * column exists.
 *
 * ENV (optional):
 *  - US_HMF_PCT          e.g., "0.125"  (meaning 0.125%)
 *  - US_HMF_EFFECTIVE    ISO date (YYYY-MM-DD), default = Jan 1 current UTC year
 *  - US_HMF_NOTES        extra note suffix
 */
function jan1UtcOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

export async function* streamHmfRows(): AsyncGenerator<SurchargeInsert> {
  const pctRaw = process.env.US_HMF_PCT ?? '0.125';
  const effRaw = process.env.US_HMF_EFFECTIVE ?? '';
  const extra = process.env.US_HMF_NOTES ? ` ${process.env.US_HMF_NOTES}` : '';

  const pct = String(Number(pctRaw));
  const effectiveFrom = effRaw ? new Date(`${effRaw}T00:00:00Z`) : jan1UtcOfCurrentYear();

  yield {
    dest: 'US',
    origin: null,
    hs6: null,
    surchargeCode: 'HMF',
    pctAmt: pct,
    fixedAmt: null,
    effectiveFrom,
    effectiveTo: null,
    notes: `US HMF ad valorem (ocean freight only).${extra}`.trim(),
  };
}
