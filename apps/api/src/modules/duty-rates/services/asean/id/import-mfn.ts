import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { fetchIdMfnDutyRates } from './fetch-mfn.js';

export async function importIdMfn(params: {
  urlOrPath?: string;
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}) {
  const rows = await fetchIdMfnDutyRates(params.urlOrPath);
  if (!rows.length) {
    throw new Error(
      '[ID Duties] MFN produced 0 rows. Check official source availability and parser compatibility.'
    );
  }

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
