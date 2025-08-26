import { fetchUsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

export async function importUsPreferential({
  effectiveFrom,
  skipFree,
  importId,
}: { effectiveFrom?: Date; skipFree?: boolean; importId?: string } = {}) {
  const rows = await fetchUsPreferentialDutyRates({ effectiveFrom, skipFree });

  return await batchUpsertDutyRatesFromStream(rows, {
    batchSize: 5000,
    importId,
    makeSourceRef: (row) => {
      const partner = row.partner ?? 'special';
      const ymd = row.effectiveFrom?.toISOString().slice(0, 10);
      return `usitc:hts:col1-special:partner=${partner}:hs6=${row.hs6}:ef=${ymd}`;
    },
  });
}
