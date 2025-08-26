// Pull Column 1 "General" (MFN) ad-valorem rates from USITC HTS, map to HS6 (max over 10-digit).
// Dest = 'US'. Only % lines are imported; compound/specific parts are ignored (flagged in notes).
//
// Official sources:
// - HTS REST API "exportList": https://hts.usitc.gov/reststop (see External User Guide, Export). :contentReference[oaicite:0]{index=0}
// - HTS archive & current exports (CSV/XLS/JSON): https://hts.usitc.gov/export and archive. :contentReference[oaicite:1]{index=1}

import type { DutyRateInsert } from '@clearcost/types';
import {
  exportChapterJson,
  getGeneralCell,
  hasCompound,
  parseAdValoremPercent,
  parseHts10,
  toNumeric3String,
} from './hts-base.js';

type FetchUsMfnOpts = {
  /** Chapters to include (2-digit). Defaults to 1..97. */
  chapters?: number[];
  /**
   * Effective date to stamp on rows. If omitted, we use today's UTC date.
   * (You can pass a specific HTS revision date if you target an archive JSON.)
   */
  effectiveFrom?: Date;
};

function jan1OfCurrentYearUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

export async function fetchUsMfnDutyRates(opts: FetchUsMfnOpts = {}): Promise<DutyRateInsert[]> {
  const chapters = opts.chapters ?? Array.from({ length: 97 }, (_, i) => i + 1);
  // If caller didn’t provide a revision/effective date, use Jan 1 (conservative single-year bucket).
  const effectiveFrom = opts.effectiveFrom ?? jan1OfCurrentYearUTC();

  // Aggregate the *maximum* ad-valorem % per HS6 across 10-digit lines (safer for landed cost).
  const byHs6 = new Map<
    string,
    { pct: number; compound: boolean } // keep a flag if any line was compound
  >();

  for (const ch of chapters) {
    const rows = await exportChapterJson(ch).catch(() => [] as Record<string, unknown>[]);
    for (const row of rows) {
      const hts10 = parseHts10(row);
      if (!hts10) continue;
      const hs6 = hts10.slice(0, 6);

      const general = getGeneralCell(row);
      const pct = parseAdValoremPercent(general);
      if (pct == null) continue; // ignore non-% (pure specific/compound/see-note)

      const compound = hasCompound(general);
      const prev = byHs6.get(hs6);
      if (!prev || pct > prev.pct) byHs6.set(hs6, { pct, compound: prev?.compound || compound });
    }
  }

  const out: DutyRateInsert[] = [];
  for (const [hs6, { pct, compound }] of byHs6) {
    out.push({
      dest: 'US',
      partner: null,
      hs6,
      ratePct: toNumeric3String(pct),
      rule: 'mfn',
      // currency stays your default ('USD'); omit to use DB default
      effectiveFrom,
      effectiveTo: null,
      notes: compound
        ? 'HTS Column 1 “General” includes additional specific/compound components on some 10-digit lines; using % only.'
        : 'HTS Column 1 “General” ad-valorem.',
    });
  }

  return out;
}
