import { fetchUsMfnDutyRates } from './mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { DEBUG } from '../../utils/utils.js';

export async function importUsMfn({
  effectiveFrom,
  importId,
}: { effectiveFrom?: Date; importId?: string } = {}) {
  if (DEBUG) {
    console.log('[US Duties] MFN starting', {
      effectiveFrom: effectiveFrom ? effectiveFrom.toISOString() : null,
      importId: importId ?? null,
    });
  }

  const rows = await fetchUsMfnDutyRates({ effectiveFrom });

  if (DEBUG) {
    const hs6Set = new Set(rows.map((r) => r.hs6));
    console.log('[US Duties] MFN fetched/parsed', {
      rows: rows.length,
      distinctHs6: hs6Set.size,
      sample: rows.slice(0, 3),
    });
  }

  const res = await batchUpsertDutyRatesFromStream(rows, {
    batchSize: 5000,
    importId,
    makeSourceRef: (row) =>
      `usitc:hts:col1-general:hs6=${row.hs6}:ef=${row.effectiveFrom?.toISOString().slice(0, 10)}`,
  });

  if (DEBUG) {
    console.log('[US Duties] MFN upsert result', {
      inserted: res?.inserted ?? 0,
      updated: res?.updated ?? 0,
      count: res?.count ?? (res?.inserted ?? 0) + (res?.updated ?? 0),
      dryRun: res?.dryRun ?? false,
    });
  }

  return res;
}
