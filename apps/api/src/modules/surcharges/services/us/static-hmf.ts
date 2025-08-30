import type { SurchargeInsert } from '@clearcost/types';

/** Jan 1 UTC of current year */
function jan1UtcOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

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
export async function* streamHmfRows(): AsyncGenerator<SurchargeInsert> {
  const pctPercentRaw = process.env.US_HMF_PCT ?? '0.125';
  const pctPercent = Number(pctPercentRaw);
  const pctFraction = Number.isFinite(pctPercent) && pctPercent >= 0 ? pctPercent / 100 : 0.00125; // default 0.125%
  const pctStr = String(pctFraction);
  const effRaw = process.env.US_HMF_EFFECTIVE ?? '';
  const extra = process.env.US_HMF_NOTES ? ` ${process.env.US_HMF_NOTES}` : '';
  const effectiveFrom = effRaw ? new Date(`${effRaw}T00:00:00Z`) : jan1UtcOfCurrentYear();
  const notes =
    `US Harbor Maintenance Fee ${pctPercent.toFixed(3)}% (ocean shipments only). Statute: 26 U.S.C. §4461.${extra}`.trim();

  yield {
    dest: 'US',
    origin: null,
    hs6: null,
    surchargeCode: 'HMF',
    rateType: 'ad_valorem',
    applyLevel: 'entry',
    valueBasis: 'customs',
    transportMode: 'OCEAN',
    currency: 'USD',
    fixedAmt: null,
    pctAmt: pctStr,
    minAmt: null,
    maxAmt: null,
    unitAmt: null,
    unitCode: null,
    sourceUrl: null,
    sourceRef: '26 U.S.C. §4461',
    notes,
    effectiveFrom,
    effectiveTo: null,
  };
}
