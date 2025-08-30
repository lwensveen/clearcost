import { z } from 'zod/v4';
import type { DutyRateInsert } from '@clearcost/types';
import { fetchWitsMfnDutyRates } from './mfn.js';
import { fetchWitsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

const DEFAULT_DESTS = [
  'US',
  'EU',
  'GB',
  'AU',
  'BH',
  'CA',
  'CL',
  'CO',
  'IL',
  'JO',
  'KR',
  'MA',
  'MX',
  'OM',
  'PA',
  'PE',
  'SG',
];

const ParamsSchema = z.object({
  dests: z.array(z.string().length(2)).optional(),
  partners: z.array(z.string().length(2)).default([]),
  year: z.number().int().min(1990).max(2100).optional(),
  backfillYears: z.number().int().min(0).max(5).default(1),
  concurrency: z.number().int().min(1).max(6).default(3),
  batchSize: z.number().int().min(1).max(20000).default(5000),
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
  importId: z.string().optional(),
  exclude: z.array(z.string().length(2)).optional(),
});

export type ImportFromWitsCore = z.infer<typeof ParamsSchema>;

/** Context used to build a stable provenance sourceRef. */
type ProvCtx = { dest: string; partner?: string | null; year: number };

/** Stable, short sourceRef: wits:DEST:PARTNER:rule:hs6=XXXXXX:ef=YYYY-MM-DD */
function defaultMakeWitsSourceRef(row: DutyRateInsert, ctx: ProvCtx): string {
  const partner = row.partner ?? ctx.partner ?? null;
  const dutyRule = row.dutyRule ?? 'mfn';
  const efIso = row.effectiveFrom
    ? new Date(row.effectiveFrom as any).toISOString().slice(0, 10)
    : String(ctx.year);
  const partnerToken = partner ?? 'ERGA';
  return `wits:${ctx.dest}:${partnerToken}:${dutyRule}:hs6=${row.hs6}:ef=${efIso}`;
}

export type ImportFromWitsParams = ImportFromWitsCore & {
  makeSourceRef?: (row: DutyRateInsert, ctx: ProvCtx) => string;
};

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

export async function importDutyRatesFromWITS(params: ImportFromWitsParams) {
  const p = ParamsSchema.parse(params);
  const makeSourceRef = params.makeSourceRef ?? defaultMakeWitsSourceRef;

  const targetYear = p.year ?? new Date().getUTCFullYear() - 1;

  const destsInput = p.dests && p.dests.length > 0 ? p.dests : DEFAULT_DESTS;
  const exclude = new Set((p.exclude ?? []).map((d) => d.toUpperCase()));
  const dests = destsInput.map((d) => d.toUpperCase()).filter((d) => !exclude.has(d));
  const partners = (p.partners ?? []).map((x) => x.toUpperCase());

  type Job = { ctx: ProvCtx; run: () => Promise<DutyRateInsert[]> };
  const jobs: Job[] = [];

  for (const dest of dests) {
    // MFN
    jobs.push({
      ctx: { dest, year: targetYear },
      run: () =>
        fetchWitsMfnDutyRates({
          dest,
          year: targetYear,
          backfillYears: p.backfillYears,
          hs6List: p.hs6List,
        }).catch(() => [] as DutyRateInsert[]),
    });

    // Preferential (if partners provided)
    for (const partner of partners) {
      if (partner === dest) continue;
      jobs.push({
        ctx: { dest, partner, year: targetYear },
        run: () =>
          fetchWitsPreferentialDutyRates({
            dest,
            partner,
            year: targetYear,
            backfillYears: p.backfillYears,
            hs6List: p.hs6List,
          }).catch(() => [] as DutyRateInsert[]),
      });
    }
  }

  if (jobs.length === 0) return { ok: true as const, inserted: 0 };

  let nextIndex = 0;

  async function worker(): Promise<number> {
    let localInserted = 0;
    while (true) {
      const i = nextIndex++;
      const job = jobs[i];
      if (!job) break;

      let rows: DutyRateInsert[] = [];
      try {
        rows = await job.run();
      } catch {
        rows = [];
      }

      if (DEBUG) {
        const tag = job.ctx.partner ? `${job.ctx.dest}-${job.ctx.partner}` : job.ctx.dest;
        console.log(`[wits] job ${tag} ${job.ctx.year} -> rows=${rows.length}`);
      }

      if (rows.length) {
        const res = await batchUpsertDutyRatesFromStream(rows, {
          batchSize: p.batchSize,
          importId: p.importId,
          source: 'wits',
          makeSourceRef: (r) => makeSourceRef(r as DutyRateInsert, job.ctx),
        });
        localInserted += res.inserted;
      }
    }
    return localInserted;
  }

  const workers = Array.from({ length: p.concurrency }, () => worker());
  const counts = await Promise.all(workers);
  return { ok: true as const, inserted: counts.reduce((a, b) => a + b, 0) };
}
