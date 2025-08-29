// Preferential (FTA) ad-valorem from USITC HTS “Special” column.
// - Parses Column 1 “Special” into (percent, partner-programs) segments.
// - Explodes program tokens to ISO2 members (from DB or CSV), supports owner-qualified lookups.
// - Aggregates per (HS6, ISO2) with conservative MAX % across 10-digit lines.

import type { DutyRateInsert } from '@clearcost/types';
import {
  exportChapterJson,
  getSpecialCell,
  hasCompound,
  parseHts10,
  toNumeric3String,
} from './hts-base.js';
import { loadMembershipFromCsv, loadMembershipFromDb, membersOn } from './spi-membership.js';

type FetchUsPrefOpts = {
  chapters?: number[];
  effectiveFrom?: Date;
  skipFree?: boolean;
  membershipCsvUrl?: string;
  conservativeMax?: boolean;
  owner?: string; // e.g. 'US'
};

function jan1OfCurrentYearUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/** Parse “Special” cell into segments of { pct, partnersCSV }. */
function parseSpecialSegments(
  cell: string | null | undefined
): Array<{ pct: number; partners: string }> {
  if (!cell) return [];
  const normalized = cell.replace(/\s+/g, ' ').trim();
  const segments: Array<{ pct: number; partners: string }> = [];

  const re = /(?:(Free)|(\d+(?:\.\d+)?)\s*%)(?:\s*\(([^)]+)\))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    const isFree = !!m[1];
    const pct = isFree ? 0 : Number(m[2]);
    if (!Number.isFinite(pct) || pct < 0) continue;
    const partnersRaw = (m[3] ?? '').trim();
    segments.push({ pct, partners: partnersRaw });
  }

  if (segments.length === 0 && /free/i.test(normalized)) {
    segments.push({ pct: 0, partners: '' });
  }
  return segments;
}

export async function fetchUsPreferentialDutyRates(
  opts: FetchUsPrefOpts = {}
): Promise<DutyRateInsert[]> {
  const chapters = opts.chapters ?? Array.from({ length: 97 }, (_, i) => i + 1);
  const effectiveFrom = opts.effectiveFrom ?? jan1OfCurrentYearUTC();
  const skipFree = !!opts.skipFree;
  const conservativeMax = opts.conservativeMax ?? true;
  const owner = (opts.owner ?? 'US').toUpperCase();

  // Load SPI membership (DB by default; CSV if provided).
  const membership = opts.membershipCsvUrl
    ? await loadMembershipFromCsv(opts.membershipCsvUrl)
    : await loadMembershipFromDb();

  type BucketVal = { pct: number; compound: boolean };
  // key = `${hs6}|${iso2}`
  const best: Map<string, BucketVal> = new Map();

  const isIso2 = (t: string) => /^[A-Z]{2}$/.test(t);
  const isHs6 = (t: string) => /^\d{6}$/.test(t);

  for (const chapter of chapters) {
    const rows = await exportChapterJson(chapter).catch(() => [] as Record<string, unknown>[]);

    for (const row of rows) {
      const hts10 = parseHts10(row);
      if (!hts10) continue;
      const hs6 = hts10.slice(0, 6);

      const specialCell = getSpecialCell(row);
      if (!specialCell) continue;

      const compoundFlag = hasCompound(specialCell);
      const segments = parseSpecialSegments(specialCell);
      if (!segments.length) continue;

      for (const { pct, partners } of segments) {
        if (skipFree && pct === 0) continue;

        const tokens = partners
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);

        if (tokens.length === 0) continue; // “Free” with no partners → not attributable

        // Expand tokens to ISO2
        const isoSet = new Set<string>();
        for (const tok of tokens) {
          if (isIso2(tok)) {
            isoSet.add(tok);
          } else {
            const owned = membersOn(membership, `${owner}:${tok}`, effectiveFrom);
            const bare = membersOn(membership, tok, effectiveFrom);
            for (const iso of owned.length ? owned : bare) isoSet.add(iso);
          }
        }

        for (const iso2 of isoSet) {
          const key = `${hs6}|${iso2}`;
          const prev = best.get(key);
          const nextPct = pct;

          if (!prev) {
            best.set(key, { pct: nextPct, compound: compoundFlag });
          } else {
            const betterPct = conservativeMax
              ? Math.max(prev.pct, nextPct)
              : Math.min(prev.pct, nextPct);
            best.set(key, { pct: betterPct, compound: prev.compound || compoundFlag });
          }
        }
      }
    }
  }

  const out: DutyRateInsert[] = [];
  for (const [key, val] of best) {
    const sep = key.indexOf('|');
    if (sep <= 0 || sep === key.length - 1) continue;

    const hs6Key = key.slice(0, sep);
    const iso2 = key.slice(sep + 1);
    if (!isHs6(hs6Key) || !isIso2(iso2)) continue;

    out.push({
      dest: 'US',
      partner: iso2,
      hs6: hs6Key, // now guaranteed string
      ratePct: toNumeric3String(val.pct),
      dutyRule: 'fta',
      currency: 'USD',
      effectiveFrom,
      effectiveTo: null,
      notes:
        `HTS Column 1 “Special” – exploded from ${owner} program tokens to ISO2` +
        (val.compound ? '; contains specific/compound components, using % only.' : ''),
    });
  }

  return out;
}
