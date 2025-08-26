import { streamMpfRows } from './static-mpf.js';
import { streamHmfRows } from './static-hmf.js';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';

type Opts = {
  batchSize?: number;
  importId?: string;
};

function ymd(d: Date | string | null | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

/**
 * Import all “baseline” US surcharges we can source reliably & cheaply:
 * - MPF (env-configured)
 * - HMF (env-configured)
 * You can append 301/232 and AD/CVD streams later without changing callers.
 */
export async function importAllUsSurcharges(opts: Opts = {}) {
  let inserted = 0;

  // MPF
  inserted += (
    await batchUpsertSurchargesFromStream(streamMpfRows(), {
      batchSize: opts.batchSize,
      importId: opts.importId,
      makeSourceRef: (r) => `static:mpf:dest=${r.dest ?? 'US'}:ef=${ymd(r.effectiveFrom)}`,
    })
  ).inserted;

  // HMF
  inserted += (
    await batchUpsertSurchargesFromStream(streamHmfRows(), {
      batchSize: opts.batchSize,
      importId: opts.importId,
      makeSourceRef: (r) => `static:hmf:dest=${r.dest ?? 'US'}:ef=${ymd(r.effectiveFrom)}`,
    })
  ).inserted;

  return { ok: true as const, inserted };
}
