// Preferential (FTA) ad-valorem from USITC HTS “Special” column.
// - Parses Column 1 “Special” into (percent, partner-programs) segments.
// - Aggregates to HS6 by keeping the MAX percent per (HS6, partner-set, percent) segment
//   across all 10-digit lines (safety-first).
// - Leaves partner program codes (e.g., "A,AU,CA") in `notes`; you can map them to ISO2 later.

import type { DutyRateInsert } from '@clearcost/types';
import {
  exportChapterJson,
  getSpecialCell,
  hasCompound,
  parseHts10,
  toNumeric3String,
} from './hts-base.js';

type FetchUsPrefOpts = {
  chapters?: number[]; // 2-digit chapters; default: 1..97
  effectiveFrom?: Date; // stamp; default: Jan 1 (UTC) of current year
  skipFree?: boolean; // omit "Free" (0%) rows; default false
};

function jan1OfCurrentYearUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/**
 * Parse “Special” cell into segments of { pct, partners }.
 * Examples:
 *   "Free (AU,CA,MX)"        -> [{ pct: 0, partners: "AU,CA,MX" }]
 *   "5% (CA,MX) 3% (IL)"     -> [{ pct: 5, partners: "CA,MX" }, { pct: 3, partners: "IL" }]
 *   "3% (A,AU) Free (CA)"    -> [{ pct: 3, partners: "A,AU" }, { pct: 0, partners: "CA" }]
 *   "Free"                   -> [{ pct: 0, partners: "" }]
 */
function parseSpecialSegments(
  cell: string | null | undefined
): Array<{ pct: number; partners: string }> {
  if (!cell) return [];
  const normalized = cell.replace(/\s+/g, ' ').trim();
  const segments: Array<{ pct: number; partners: string }> = [];

  const re = /(?:(Free)|(\d+(?:\.\d+)?)\s*%)(?:\s*\(([^)]+)\))?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const isFree = !!match[1];
    const pct = isFree ? 0 : Number(match[2]);
    if (!Number.isFinite(pct) || pct < 0) continue;
    const partnersRaw = (match[3] ?? '').trim(); // e.g., "AU,CA,MX" or ""
    segments.push({ pct, partners: partnersRaw });
  }

  if (segments.length === 0 && /free/i.test(normalized)) {
    segments.push({ pct: 0, partners: '' });
  }
  return segments;
}

/**
 * Fetch US preferential (FTA) ad-valorem from HTS “Special”.
 * One output row per (HS6, partner-program set, percent) segment, percent kept as numeric(6,3) string.
 */
export async function fetchUsPreferentialDutyRates(
  opts: FetchUsPrefOpts = {}
): Promise<DutyRateInsert[]> {
  const chapters = opts.chapters ?? Array.from({ length: 97 }, (_, i) => i + 1); // 1..97
  const effectiveFrom = opts.effectiveFrom ?? jan1OfCurrentYearUTC();
  const skipFree = !!opts.skipFree;

  type BucketValue = { pct: number; compound: boolean };
  // key: `${hs6}|${partnersNorm}|${pct}`
  const bucket = new Map<string, BucketValue>();

  for (const chapter of chapters) {
    const rows = await exportChapterJson(chapter).catch(() => [] as Record<string, unknown>[]);
    for (const row of rows) {
      const hts10 = parseHts10(row);
      if (!hts10) continue;
      const hs6 = hts10.slice(0, 6); // always 6 chars

      const specialCell = getSpecialCell(row);
      if (!specialCell) continue;

      const compoundFlag = hasCompound(specialCell);
      const segments = parseSpecialSegments(specialCell);
      if (!segments.length) continue;

      for (const { pct, partners } of segments) {
        if (skipFree && pct === 0) continue;

        // Normalize partner token list for stable keys
        const partnersNorm = partners
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .join(',');

        const key = `${hs6}|${partnersNorm}|${pct}`;
        const prev = bucket.get(key);
        // Keep MAX pct for the same segment across multiple 10-digit lines
        if (!prev || pct > prev.pct) {
          bucket.set(key, { pct, compound: (prev?.compound ?? false) || compoundFlag });
        }
      }
    }
  }

  // Materialize rows – parse key safely to avoid undefined types
  const out: DutyRateInsert[] = [];
  for (const [key, value] of bucket) {
    const parts = key.split('|');
    const hs6FromKey = parts[0] ?? '';
    const partnersNorm = parts[1] ?? '';

    if (!hs6FromKey) continue;

    out.push({
      dest: 'US',
      hs6: hs6FromKey,
      ratePct: toNumeric3String(value.pct),
      rule: 'fta',
      partner: null,
      effectiveFrom,
      effectiveTo: null,
      notes:
        `HTS Column 1 “Special” – partners: ${partnersNorm || 'programs:unspecified'}` +
        (value.compound ? '; contains specific/compound components, using % only.' : ''),
    });
  }

  return out;
}
