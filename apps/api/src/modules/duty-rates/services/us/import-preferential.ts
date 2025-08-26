import { fetchUsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

export async function importUsPreferential({
  effectiveFrom,
  skipFree,
}: { effectiveFrom?: Date; skipFree?: boolean } = {}) {
  const rows = await fetchUsPreferentialDutyRates({ effectiveFrom, skipFree });
  return await batchUpsertDutyRatesFromStream(rows, { batchSize: 5000 });
}
