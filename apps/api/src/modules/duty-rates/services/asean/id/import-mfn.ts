import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { fetchIdMfnDutyRates } from './fetch-mfn.js';

export async function importIdMfn(params: {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}) {
  const rows = await fetchIdMfnDutyRates();
  if (!rows.length)
    return { ok: true as const, inserted: 0, updated: 0, count: 0, dryRun: !!params.dryRun };

  const res = await batchUpsertDutyRatesFromStream(rows, {
    batchSize: params.batchSize ?? 5000,
    dryRun: params.dryRun,
    importId: params.importId,
    source: 'official',
    makeSourceRef: (row) => `id:mfn:${row.hs6}`,
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
