// WITS duty-rates import orchestrator (MFN + Preferential) with bounded concurrency
// and batched upserts to keep memory flat.
//
// Why this version?
// - Uses a small worker pool (p.concurrency) so we don't fire all HTTP jobs at once.
// - Upserts each job's results immediately via batchUpsertDutyRatesFromStream (default 5k/txn).
// - Avoids building one giant in-memory array.
//
// Examples:
//   await importDutyRatesFromWITS({ dests: ['US','GB'], partners: ['CA','MX'] });
//   await importDutyRatesFromWITS({ dests: ['TH'], year: 2024, backfillYears: 0, batchSize: 2000, concurrency: 4 });

import { z } from 'zod/v4';
import type { DutyRateInsert } from '@clearcost/types';
import { fetchWitsMfnDutyRates } from './mfn.js';
import { fetchWitsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

const ParamsSchema = z.object({
  /** ISO2 reporter markets to ingest (e.g., ["US","GB","TH"]). */
  dests: z.array(z.string().length(2)).min(1),

  /** Optional ISO2 partner list for preferential (FTA) imports. Empty => MFN only. */
  partners: z.array(z.string().length(2)).default([]),

  /** WITS is often T-1; default to last UTC year if not provided. */
  year: z.number().int().min(1990).max(2100).optional(),

  /** Also fetch prior years (0..5). Default 1 (fetch targetYear and targetYear-1). */
  backfillYears: z.number().int().min(0).max(5).default(1),

  /** Limit concurrent HTTP jobs (1..6). Default 3. */
  concurrency: z.number().int().min(1).max(6).default(3),

  /** DB upsert batch size (rows/transaction). Default 5000. */
  batchSize: z.number().int().min(1).max(20000).default(5000),

  /** Optional HS6 allowlist to reduce scope across all jobs. */
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
});

export type ImportFromWitsParams = z.infer<typeof ParamsSchema>;

export async function importDutyRatesFromWITS(params: ImportFromWitsParams) {
  const p = ParamsSchema.parse(params);
  const targetYear = p.year ?? new Date().getUTCFullYear() - 1;

  type Job = () => Promise<DutyRateInsert[]>;
  const jobs: Job[] = [];

  for (const dest of p.dests) {
    jobs.push(() =>
      fetchWitsMfnDutyRates({
        dest,
        year: targetYear,
        backfillYears: p.backfillYears,
        hs6List: p.hs6List,
      }).catch(() => [] as DutyRateInsert[])
    );

    for (const partner of p.partners) {
      jobs.push(() =>
        fetchWitsPreferentialDutyRates({
          dest,
          partner,
          year: targetYear,
          backfillYears: p.backfillYears,
          hs6List: p.hs6List,
        }).catch(() => [] as DutyRateInsert[])
      );
    }
  }

  if (jobs.length === 0) {
    return { ok: true as const, inserted: 0 };
  }

  let nextIndex = 0;

  async function worker(): Promise<number> {
    let localInserted = 0;

    while (true) {
      const i = nextIndex++;
      const job: Job | undefined = jobs[i];
      if (!job) break;

      let rows: DutyRateInsert[] = [];
      try {
        rows = await job();
      } catch {
        rows = [];
      }

      if (rows.length > 0) {
        const res = await batchUpsertDutyRatesFromStream(rows, { batchSize: p.batchSize });
        localInserted += res.inserted;
      }
    }

    return localInserted;
  }

  const workers = Array.from({ length: p.concurrency }, () => worker());
  const counts = await Promise.all(workers);
  const inserted = counts.reduce((a, b) => a + b, 0);

  return { ok: true as const, inserted };
}
