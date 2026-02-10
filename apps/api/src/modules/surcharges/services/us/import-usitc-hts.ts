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
  return Number.isFinite(v) && v >= 0 ? v : null; // whole percent, e.g. 25 for "25%"
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
 *
 * NOTE: pctAmt stored as a fraction (0–1). We convert from “25%” → "0.250000".
 */
export async function importUsTradeRemediesFromHTS(
  opts: ImportOpts = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number }> {
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
    const pctWhole = parsePercent(general); // e.g., 25 for "25%"
    if (pctWhole == null) continue;
    if (opts.skipFree && pctWhole === 0) continue;

    const code = klass === '301' ? 'TRADE_REMEDY_301' : 'TRADE_REMEDY_232';
    const prev = buckets[code];
    if (!prev || pctWhole > prev.maxPct) {
      buckets[code] = { maxPct: pctWhole, anyHts10: hts10, anyText: general ?? undefined };
    }
  }

  const out: SurchargeInsert[] = [];

  // Shared defaults for schema fields we always set
  const base: Pick<
    SurchargeInsert,
    | 'dest'
    | 'origin'
    | 'hs6'
    | 'rateType'
    | 'applyLevel'
    | 'valueBasis'
    | 'transportMode'
    | 'currency'
    | 'fixedAmt'
    | 'minAmt'
    | 'maxAmt'
    | 'unitAmt'
    | 'unitCode'
  > = {
    dest: 'US',
    origin: null,
    hs6: null,
    rateType: 'ad_valorem',
    applyLevel: 'entry',
    valueBasis: 'customs',
    transportMode: 'ALL',
    currency: 'USD',
    fixedAmt: null,
    minAmt: null,
    maxAmt: null,
    unitAmt: null,
    unitCode: null,
  };

  if (buckets.TRADE_REMEDY_301) {
    const b = buckets.TRADE_REMEDY_301;
    const fraction = (b.maxPct / 100).toFixed(6); // "0.250000"
    out.push({
      ...base,
      origin: 'CN', // scope commonly CN; refine later if needed
      surchargeCode: 'TRADE_REMEDY_301',
      pctAmt: fraction,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_301', b.anyHts10, b.anyText),
    });
  }
  if (buckets.TRADE_REMEDY_232) {
    const b = buckets.TRADE_REMEDY_232;
    const fraction = (b.maxPct / 100).toFixed(6);
    out.push({
      ...base,
      origin: null, // global unless narrowed
      surchargeCode: 'TRADE_REMEDY_232',
      pctAmt: fraction,
      effectiveFrom,
      effectiveTo: null,
      notes: makeNotes('TRADE_REMEDY_232', b.anyHts10, b.anyText),
    });
  }

  if (!out.length) {
    throw new Error(
      '[USITC surcharges] produced 0 rows. Check HTS source availability and parser compatibility.'
    );
  }

  const res = await batchUpsertSurchargesFromStream(out, {
    batchSize: opts.batchSize ?? 5000,
    importId: opts.importId,
    makeSourceRef: (r) => {
      const program = r.surchargeCode === 'TRADE_REMEDY_301' ? '301' : '232';
      const origin = r.origin ?? 'ALL';
      const hs = r.hs6 ?? 'ALL';
      const ef =
        r.effectiveFrom instanceof Date
          ? r.effectiveFrom.toISOString().slice(0, 10)
          : String(r.effectiveFrom).slice(0, 10);
      return `usitc:hts:program=${program}:origin=${origin}:hs6=${hs}:ef=${ef}`;
    },
  });

  return {
    ok: true as const,
    inserted: res.inserted ?? 0,
    updated: res.updated ?? 0,
    count: res.count ?? 0,
  };
}
