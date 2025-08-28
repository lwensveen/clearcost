import type { SurchargeInsert } from '@clearcost/types';

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
function jan1UtcOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

export async function* streamMpfRows(): AsyncGenerator<SurchargeInsert> {
  const pctRaw = process.env.US_MPF_PCT ?? ''; // as plain number string, e.g. "0.3464"
  const minRaw = process.env.US_MPF_MIN ?? '';
  const maxRaw = process.env.US_MPF_MAX ?? '';
  const effRaw = process.env.US_MPF_EFFECTIVE ?? '';
  const extra = process.env.US_MPF_NOTES ? ` ${process.env.US_MPF_NOTES}` : '';

  // Store percent as numeric(6,3)-style string in our row (importer casts to SQL numeric)
  // Our schema expects pctAmt as string | null.
  const pct = pctRaw ? String(Number(pctRaw)) : null;

  const effectiveFrom = effRaw ? new Date(`${effRaw}T00:00:00Z`) : jan1UtcOfCurrentYear();

  const thresholds = minRaw || maxRaw ? ` (min ${minRaw || 'n/a'}, max ${maxRaw || 'n/a'})` : '';

  yield {
    dest: 'US',
    origin: null,
    hs6: null,
    surchargeCode: 'MPF',
    pctAmt: pct,
    fixedAmt: null,
    effectiveFrom,
    effectiveTo: null,
    notes: `US MPF ad valorem${thresholds}.${extra}`.trim(),
  };
}
