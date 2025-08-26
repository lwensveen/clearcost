import { fetchUsMfnDutyRates } from './mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

export async function importUsMfn({ effectiveFrom }: { effectiveFrom?: Date } = {}) {
  const rows = await fetchUsMfnDutyRates({ effectiveFrom });
  return await batchUpsertDutyRatesFromStream(rows, { batchSize: 5000 });
}
