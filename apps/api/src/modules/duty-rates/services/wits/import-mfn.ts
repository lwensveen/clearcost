import type { DutyRateInsert } from '@clearcost/types';
import { fetchWitsMfnDutyRates } from './mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

function efIso(d: DutyRateInsert['effectiveFrom']): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

/**
 * MFN (ERGA OMNES) duties via WITS/UNCTAD (MFN only — no PRF).
 * Upserts in batches and records provenance as `wits:DEST:ERGA:mfn:hs6=...:ef=YYYY-MM-DD`.
 */
export async function importMfnFromWits(params: {
  dest: string; // ISO2 reporter (e.g., 'CN', 'ID', 'JP')
  hs6List?: string[];
  backfillYears?: number; // default 1
  batchSize?: number; // default 5000
  importId?: string;
  dryRun?: boolean;
}) {
  const dest = params.dest.toUpperCase();
  const backfillYears = Math.max(0, params.backfillYears ?? 1);
  const batchSize = Math.max(1, params.batchSize ?? 5000);

  // Pull MFN rows from WITS
  const rows = await fetchWitsMfnDutyRates({
    dest,
    backfillYears,
    hs6List: params.hs6List,
  });

  if (!rows.length) {
    throw new Error(
      `[WITS MFN] ${dest} produced 0 rows. Check WITS source availability and extraction filters.`
    );
  }

  // Upsert with provenance tags
  const res = await batchUpsertDutyRatesFromStream(rows, {
    batchSize,
    importId: params.importId,
    dryRun: params.dryRun,
    source: 'wits',
    makeSourceRef: (r) => `wits:${dest}:ERGA:mfn:hs6=${r.hs6}:ef=${efIso(r.effectiveFrom)}`,
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
