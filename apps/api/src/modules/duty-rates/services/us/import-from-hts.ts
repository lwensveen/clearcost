import { fetchUsMfnDutyRates } from './mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

export async function importUsMfn({
  effectiveFrom,
  importId,
}: { effectiveFrom?: Date; importId?: string } = {}) {
  const rows = await fetchUsMfnDutyRates({ effectiveFrom });

  return await batchUpsertDutyRatesFromStream(rows, {
    batchSize: 5000,
    importId,
    makeSourceRef: (row) =>
      `usitc:hts:col1-general:hs6=${row.hs6}:ef=${row.effectiveFrom?.toISOString().slice(0, 10)}`,
  });
}
