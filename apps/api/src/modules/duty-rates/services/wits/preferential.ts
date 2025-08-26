import type { DutyRateInsert } from '@clearcost/types';
import { fetchSdmx, flattenWitsSeries, toWitsReporter } from './base.js';

type PrefOpts = {
  dest: string; // ISO2 or EU
  partner: string; // ISO2 or EU
  year?: number; // default: last year (UTC now - 1)
  backfillYears?: number; // default: 1
  hs6List?: string[]; // optional allowlist
};

export async function fetchWitsPreferentialDutyRates(opts: PrefOpts): Promise<DutyRateInsert[]> {
  const now = new Date();
  const targetYear = opts.year ?? now.getUTCFullYear() - 1;
  const backfill = Math.max(0, opts.backfillYears ?? 1);

  const { reporter, displayDest } = toWitsReporter(opts.dest);
  const { reporter: partnerToken, displayDest: partnerDisplay } = toWitsReporter(opts.partner);
  const hs6Allow = new Set((opts.hs6List ?? []).map((s) => String(s).slice(0, 6)));

  const rows: DutyRateInsert[] = [];
  for (let y = targetYear; y >= targetYear - backfill; y--) {
    const json = await fetchSdmx(reporter, partnerToken, y, y);
    if (!json) continue;
    rows.push(...flattenWitsSeries(json, displayDest, y, 'prf', partnerDisplay)); // set partner
  }

  const filtered = hs6Allow.size ? rows.filter((r) => hs6Allow.has(r.hs6)) : rows;

  // Keep latest effectiveFrom per (dest, partner, hs6)
  const best = new Map<string, DutyRateInsert>();
  for (const r of filtered) {
    const k = `${r.dest}:${r.partner ?? 'NULL'}:${r.hs6}`;
    const prev = best.get(k);
    if (!prev || (prev.effectiveFrom && r.effectiveFrom && r.effectiveFrom > prev.effectiveFrom)) {
      best.set(k, r);
    }
  }
  return Array.from(best.values());
}
