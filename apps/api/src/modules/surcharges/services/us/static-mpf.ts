import type { SurchargeInsert } from '@clearcost/types';

/** Jan 1 UTC of current year */
function jan1UtcOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/**
 * Merchandise Processing Fee (MPF) – ad valorem for most formal entries,
 * subject to min/max per entry. Values are supplied via env so you can update
 * annually without code changes.
 *
 * ENV (optional):
 *  - US_MPF_PCT          e.g., "0.3464"  (meaning 0.3464%)
 *  - US_MPF_MIN          e.g., "31.67"
 *  - US_MPF_MAX          e.g., "614.35"
 *  - US_MPF_EFFECTIVE    ISO date (YYYY-MM-DD), default = Jan 1 current UTC year
 *  - US_MPF_NOTES        extra note suffix
 */
export async function* streamMpfRows(): AsyncGenerator<SurchargeInsert> {
  const pctPercentRaw = process.env.US_MPF_PCT ?? ''; // e.g., "0.3464" (%)
  const pctPercent = Number(pctPercentRaw);
  const pctStr = Number.isFinite(pctPercent) && pctPercent >= 0 ? String(pctPercent / 100) : null;
  const minRaw = process.env.US_MPF_MIN ?? '';
  const maxRaw = process.env.US_MPF_MAX ?? '';
  const minAmtStr = minRaw ? Number(minRaw).toFixed(2) : null;
  const maxAmtStr = maxRaw ? Number(maxRaw).toFixed(2) : null;
  const effRaw = process.env.US_MPF_EFFECTIVE ?? '';
  const extra = process.env.US_MPF_NOTES ? ` ${process.env.US_MPF_NOTES}` : '';
  const effectiveFrom = effRaw ? new Date(`${effRaw}T00:00:00Z`) : jan1UtcOfCurrentYear();
  const thresholds =
    minAmtStr || maxAmtStr ? ` (min ${minAmtStr ?? 'n/a'}, max ${maxAmtStr ?? 'n/a'})` : '';
  const pctForNote =
    Number.isFinite(pctPercent) && pctPercent >= 0 ? `${pctPercent.toFixed(4)}%` : 'unknown%';
  const notes =
    `US MPF ad valorem ${pctForNote}${thresholds}. CFR: 19 CFR §24.23(b)(1)(i)(A)-(B).${extra}`.trim();

  yield {
    dest: 'US',
    origin: null,
    hs6: null,
    surchargeCode: 'MPF',
    rateType: 'ad_valorem',
    applyLevel: 'entry',
    valueBasis: 'customs',
    transportMode: 'ALL',
    currency: 'USD',
    fixedAmt: null,
    pctAmt: pctStr,
    minAmt: minAmtStr,
    maxAmt: maxAmtStr,
    unitAmt: null,
    unitCode: null,
    sourceUrl: null,
    sourceRef: '19 CFR §24.23(b)(1)(i)',
    notes,
    effectiveFrom,
    effectiveTo: null,
  };
}
