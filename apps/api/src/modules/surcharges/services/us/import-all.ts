import { streamMpfRows } from './static-mpf.js';
import { streamHmfRows } from './static-hmf.js';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';
import type { SurchargeInsert } from '@clearcost/types';

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
export async function importAllUsSurcharges(opts: Opts = {}): Promise<{ ok: true; count: number }> {
  const batchSize = opts.batchSize;
  let count = 0;

  // MPF
  count += (
    await batchUpsertSurchargesFromStream(streamMpfRows(), {
      batchSize,
      importId: opts.importId,
      makeSourceRef: (r: SurchargeInsert) =>
        `static:mpf:dest=${r.dest ?? 'US'}:ef=${ymd(r.effectiveFrom)}`,
    })
  ).count;

  // HMF
  count += (
    await batchUpsertSurchargesFromStream(streamHmfRows(), {
      batchSize,
      importId: opts.importId,
      makeSourceRef: (r: SurchargeInsert) =>
        `static:hmf:dest=${r.dest ?? 'US'}:ef=${ymd(r.effectiveFrom)}`,
    })
  ).count;

  return { ok: true as const, count };
}
