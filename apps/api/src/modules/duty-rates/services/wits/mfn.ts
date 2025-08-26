import type { DutyRateInsert } from '@clearcost/types';
import { fetchSdmx, flattenWitsSeries, toWitsReporter } from './base.js';

type MfnOpts = {
  dest: string; // ISO2 (e.g., "US", "TH") or "EU"/"EUN"
  year?: number; // default: last year (UTC now - 1)
  backfillYears?: number; // default: 1 (also fetch year-1)
  hs6List?: string[]; // optional allowlist (6-digit)
};

export async function fetchWitsMfnDutyRates(opts: MfnOpts): Promise<DutyRateInsert[]> {
  const now = new Date();
  const targetYear = opts.year ?? now.getUTCFullYear() - 1;
  const backfill = Math.max(0, opts.backfillYears ?? 1);

  const { reporter, displayDest } = toWitsReporter(opts.dest);
  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));

  const rows: DutyRateInsert[] = [];
  for (let y = targetYear; y >= targetYear - backfill; y--) {
    const json = await fetchSdmx(reporter, 'wld', y, y);
    if (!json) continue;
    rows.push(...flattenWitsSeries(json, displayDest, y, 'mfn', null)); // partner=null for MFN
  }

  const filtered = hs6Allow.size ? rows.filter((r) => hs6Allow.has(r.hs6)) : rows;

  // Keep latest effectiveFrom per (dest, hs6)
  const best = new Map<string, DutyRateInsert>();
  for (const r of filtered) {
    const k = `${r.dest}:${r.hs6}`;
    const prev = best.get(k);
    if (!prev || (prev.effectiveFrom && r.effectiveFrom && r.effectiveFrom > prev.effectiveFrom)) {
      best.set(k, r);
    }
  }
  return Array.from(best.values());
}
