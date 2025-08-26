import { streamMpfRows } from './static-mpf.js';
import { streamHmfRows } from './static-hmf.js';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';

/**
 * Import all “baseline” US surcharges we can source reliably & cheaply:
 * - MPF (env-configured)
 * - HMF (env-configured)
 * You can append 301/232 and AD/CVD streams later without changing callers.
 */
export async function importAllUsSurcharges(opts: { batchSize?: number } = {}) {
  let inserted = 0;

  // Run each small stream & upsert immediately; keeps memory flat.
  inserted += (await batchUpsertSurchargesFromStream(streamMpfRows(), opts)).inserted;
  inserted += (await batchUpsertSurchargesFromStream(streamHmfRows(), opts)).inserted;

  return { ok: true as const, inserted };
}
