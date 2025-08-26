import type { SurchargeInsert } from '@clearcost/types';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';
import {
  exportChapterJson,
  hasCompound,
  parseHts10,
} from '../../../duty-rates/services/us/hts-base.js';

type ImportOpts = {
  effectiveFrom?: Date; // default: Jan 1 UTC of current year
  skipFree?: boolean; // drop 0% rows
  importId?: string; // provenance run id
  batchSize?: number; // upsert batch size (default 5000)
};

function jan1UTCOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function parsePercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(String(text));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function getGeneralDutyCell(row: Record<string, unknown>): string | null {
  const candidates = [
    'column1General',
    'column_1_general',
    'general',
    'general_rate',
    'general_duty_rate',
    'col1_general',
    'col_1_general',
    'general_rate_of_duty_1',
  ];
  for (const k of candidates) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function classifyTradeRemedy(hts10: string): '301' | '232' | null {
  if (/^9903\.88\./.test(hts10)) return '301';
  if (/^9903\.(80|85)\./.test(hts10)) return '232';
  return null;
}

function makeNotes(
  code: 'TRADE_REMEDY_301' | 'TRADE_REMEDY_232',
  hts10: string,
  generalCell?: string
) {
  const base =
    code === 'TRADE_REMEDY_301'
      ? `HTS ${hts10} – Section 301 (additional duty)`
      : `HTS ${hts10} – Section 232 (additional duty)`;
  const comp = generalCell && hasCompound(generalCell) ? '; contains specific/compound text' : '';
  return `${base}${comp}.`;
}

/**
 * Scan HTS Ch.99 and insert program-level surcharge rows (301, 232).
 * Writes provenance when `importId` is provided.
 */
export async function importUsTradeRemediesFromHTS(
  opts: ImportOpts = {}
): Promise<{ ok: true; inserted: number; count: number }> {
  const effectiveFrom = opts.effectiveFrom ?? jan1UTCOfCurrentYear();

  type Bucket = { maxPct: number; anyHts10: string; anyText?: string };
  const buckets: Record<'TRADE_REMEDY_301' | 'TRADE_REMEDY_232', Bucket | undefined> = {
    TRADE_REMEDY_301: undefined,
    TRADE_REMEDY_232: undefined,
  };

  const rows = await exportChapterJson(99).catch(() => [] as Record<string, unknown>[]);
  for (const row of rows) {
    const hts10 = parseHts10(row);
    if (!hts10) continue;

    const klass = classifyTradeRemedy(hts10);
    if (!klass) continue;

    const general = getGeneralDutyCell(row);
    const pct = parsePercent(general);
    if (pct == null) continue;
    if (opts.skipFree && pct === 0) continue;

    const code = klass === '301' ? 'TRADE_REMEDY_301' : 'TRADE_REMEDY_232';
    const prev = buckets[code];
    if (!prev || pct > prev.maxPct) {
      buckets[code] = { maxPct: pct, anyHts10: hts10, anyText: general ?? undefined };
    }
  }

  const out: SurchargeInsert[] = [];
  if (buckets.TRADE_REMEDY_301) {
    const b = buckets.TRADE_REMEDY_301;
    out.push({
      dest: 'US',
      origin: 'CN',
      hs6: null, // v2: map coverage into hs6 via U.S. Notes
      code: 'TRADE_REMEDY_301',
      pctAmt: b.maxPct.toFixed(3),
      fixedAmt: null,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_301', b.anyHts10, b.anyText),
    });
  }
  if (buckets.TRADE_REMEDY_232) {
    const b = buckets.TRADE_REMEDY_232;
    out.push({
      dest: 'US',
      origin: null,
      hs6: null,
      code: 'TRADE_REMEDY_232',
      pctAmt: b.maxPct.toFixed(3),
      fixedAmt: null,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_232', b.anyHts10, b.anyText),
    });
  }

  if (!out.length) return { ok: true as const, inserted: 0, count: 0 };

  const res = await batchUpsertSurchargesFromStream(out, {
    batchSize: opts.batchSize ?? 5000,
    importId: opts.importId,
    makeSourceRef: (r) => {
      const program = r.code === 'TRADE_REMEDY_301' ? '301' : '232';
      const origin = r.origin ?? 'ALL';
      const hs = r.hs6 ?? 'ALL';
      const ef = r.effectiveFrom instanceof Date ? r.effectiveFrom.toISOString().slice(0, 10) : '';
      return `usitc:hts:program=${program}:origin=${origin}:hs6=${hs}:ef=${ef}`;
    },
  });

  const inserted = res.inserted ?? 0;
  return { ok: true as const, inserted, count: inserted };
}
