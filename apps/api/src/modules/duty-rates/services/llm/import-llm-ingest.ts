import type { dutyRatesTable } from '@clearcost/db';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import {
  type LlmDutyRowForComponents,
  upsertDutyRateComponentsForLLM,
} from './upsert-duty-components.js';

/** LLM row shape we ingest (same as components module) */
export type LlmDutyRow = LlmDutyRowForComponents;

type DutyInsert = typeof dutyRatesTable.$inferInsert;
type DutySelect = typeof dutyRatesTable.$inferSelect;

const toDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const up2 = (s?: string | null) => (s ? s.trim().toUpperCase() : '');

/** Coerce free-text to our enum literals (defaults to 'mfn'). */
function coerceDutyRule(s?: string | null): DutyInsert['dutyRule'] {
  const k = String(s || 'mfn').toLowerCase();
  if (k === 'mfn' || k === 'fta' || k === 'anti_dumping' || k === 'safeguard') return k;
  return 'mfn';
}

/** Pull headline ad-valorem % for duty_rates.rate_pct (NUMERIC(6,3) percent) */
function pickHeadlinePct(components: LlmDutyRow['components']): string {
  const v = components.find(
    (c) => c.type === 'advalorem' && typeof c.rate_pct === 'number'
  )?.rate_pct;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return (Math.round(v * 1000) / 1000).toFixed(3);
  }
  return '0.000';
}

/**
 * Ingest reconciled LLM duty rows:
 * - writes headline rows into duty_rates (source='llm')
 * - writes detailed components into duty_rate_components
 * - optional provenance via makeSourceRef(importId)
 */
export async function importDutyRatesFromLLM(
  rows: LlmDutyRow[],
  opts: {
    importId?: string;
    /** Narrow callback: you only need a few fields to build your sourceRef key */
    makeSourceRef?: (row: {
      dest: string;
      partner?: string | null;
      hs6: string;
      dutyRule: DutyInsert['dutyRule'];
      effectiveFrom: Date;
    }) => string | undefined;
  } = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number }> {
  if (!rows?.length) return { ok: true as const, inserted: 0, updated: 0, count: 0 };

  const headline: DutyInsert[] = rows.map((r) => ({
    dest: up2(r.country_code), // ISO2
    partner: up2(r.partner ?? ''), // '' sentinel for MFN
    hs6: r.hs6,
    dutyRule: coerceDutyRule(r.duty_rule),
    ratePct: pickHeadlinePct(r.components), // headline % (or 0.000)
    effectiveFrom: toDate(r.effective_from),
    effectiveTo: null, // open-ended
    notes: null,
    source: 'llm', // OFFICIAL/WITS can overwrite later
  }));

  const makeSourceRefWrapped = opts.makeSourceRef
    ? (row: DutySelect) =>
        opts.makeSourceRef!({
          dest: row.dest,
          partner: row.partner,
          hs6: row.hs6,
          dutyRule: row.dutyRule,
          effectiveFrom: (row.effectiveFrom ?? new Date(0)) as Date,
        })
    : undefined;

  const res = await batchUpsertDutyRatesFromStream(headline, {
    source: 'llm',
    importId: opts.importId,
    makeSourceRef: makeSourceRefWrapped,
  });

  await upsertDutyRateComponentsForLLM(rows, { importId: opts.importId });

  return { ok: true as const, inserted: res.inserted, updated: res.updated, count: res.count };
}
