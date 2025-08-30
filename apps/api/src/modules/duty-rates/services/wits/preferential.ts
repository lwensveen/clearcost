import type { DutyRateInsert } from '@clearcost/types';
import { fetchSdmx, flattenWitsSeries, toNumericReporterOrUnion } from './base.js';

const DEBUG =
  process.argv.includes('--debug') || process.env.DEBUG === '1' || process.env.WITS_LOG === '1';

type PrefOpts = {
  dest: string;
  partner: string;
  year?: number;
  backfillYears?: number;
  hs6List?: string[];
};

export async function fetchWitsPreferentialDutyRates(opts: PrefOpts): Promise<DutyRateInsert[]> {
  const now = new Date();
  const targetYear = opts.year ?? now.getUTCFullYear() - 1;
  const backfill = Math.max(0, opts.backfillYears ?? 1);

  const { token: reporter, display: displayDest } = toNumericReporterOrUnion(opts.dest);
  const { token: partnerToken, display: partnerDisplay } = toNumericReporterOrUnion(opts.partner);

  if (DEBUG) {
    console.log('[wits] PRF tokens', {
      dest: opts.dest,
      reporter,
      partner: opts.partner,
      partnerToken,
    });
  }

  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));
  const rows: DutyRateInsert[] = [];

  for (let y = targetYear; y >= targetYear - backfill; y--) {
    const json = await fetchSdmx(reporter, partnerToken, y, y);
    if (!json) {
      if (DEBUG) console.log(`[wits] PRF ${displayDest}-${partnerDisplay} ${y} -> no JSON`);
      continue;
    }
    const got = flattenWitsSeries(json, displayDest, y, 'prf', partnerDisplay);
    if (DEBUG) {
      console.log(`[wits] PRF ${displayDest}-${partnerDisplay} ${y} -> flatten rows=${got.length}`);
      if (got.length) {
        const sample = got.slice(0, 5).map((r) => `${r.partner}:${r.hs6}:${r.ratePct}`);
        console.log('[wits] PRF sample', sample);
      }
    }
    rows.push(...got);
  }

  const filtered = hs6Allow.size ? rows.filter((r) => hs6Allow.has(r.hs6)) : rows;
  if (DEBUG) console.log('[wits] PRF total after filter', filtered.length);

  // Dedup latest per (dest, partner, hs6)
  const best = new Map<string, DutyRateInsert>();
  for (const r of filtered) {
    const k = `${r.dest}:${r.partner ?? ''}:${r.hs6}`;
    const prev = best.get(k);
    if (!prev || (prev.effectiveFrom && r.effectiveFrom && r.effectiveFrom > prev.effectiveFrom)) {
      best.set(k, r);
    }
  }
  const out = Array.from(best.values());
  if (DEBUG) console.log('[wits] PRF total after dedup', out.length);
  return out;
}
