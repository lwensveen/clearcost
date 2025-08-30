import type { DutyRateInsert } from '@clearcost/types';
import { fetchSdmx, flattenWitsSeries, toNumericReporterOrUnion } from './base.js';

const DEBUG =
  process.argv.includes('--debug') || process.env.DEBUG === '1' || process.env.WITS_LOG === '1';

type MfnOpts = {
  dest: string;
  year?: number;
  backfillYears?: number;
  hs6List?: string[];
};

export async function fetchWitsMfnDutyRates(opts: MfnOpts): Promise<DutyRateInsert[]> {
  const now = new Date();
  const targetYear = opts.year ?? now.getUTCFullYear() - 1;
  const backfill = Math.max(0, opts.backfillYears ?? 1);

  const { token: reporter, display } = toNumericReporterOrUnion(opts.dest);
  if (DEBUG) console.log('[wits] MFN tokens', { dest: opts.dest, reporter });

  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));
  const rows: DutyRateInsert[] = [];

  for (let y = targetYear; y >= targetYear - backfill; y--) {
    const json = await fetchSdmx(reporter, '000', y, y); // 000 = world partner (MFN)
    if (!json) {
      if (DEBUG) console.log(`[wits] MFN ${display} ${y} -> no JSON`);
      continue;
    }
    const got = flattenWitsSeries(json, display, y, 'mfn', null);
    if (DEBUG) {
      console.log(`[wits] MFN ${display} ${y} -> flatten rows=${got.length}`);
      if (got.length) {
        const sample = got.slice(0, 5).map((r) => `${r.hs6}:${r.ratePct}`);
        console.log('[wits] MFN sample', sample);
      }
    }
    rows.push(...got);
  }

  const filtered = hs6Allow.size ? rows.filter((r) => hs6Allow.has(r.hs6)) : rows;
  if (DEBUG) console.log('[wits] MFN total after filter', filtered.length);

  // Dedup latest per (dest, hs6)
  const best = new Map<string, DutyRateInsert>();
  for (const r of filtered) {
    const k = `${r.dest}:${r.hs6}`;
    const prev = best.get(k);
    if (!prev || (prev.effectiveFrom && r.effectiveFrom && r.effectiveFrom > prev.effectiveFrom)) {
      best.set(k, r);
    }
  }
  const out = Array.from(best.values());
  if (DEBUG) console.log('[wits] MFN total after dedup', out.length);
  return out;
}
