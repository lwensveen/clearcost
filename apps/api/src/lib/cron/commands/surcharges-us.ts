import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { importUsTradeRemediesFromHTS } from '../../../modules/surcharges/services/us/import-usitc-hts.js';
import {
  fiscalYear,
  upsertUSBaseSurcharges,
} from '../../../modules/surcharges/services/us/us-cbp.js';
import { importAphisAqiSurcharges } from '../../../modules/surcharges/services/us/import-aphis-aqi.js';
import { importFdaFsmaSurcharges } from '../../../modules/surcharges/services/us/import-fda-fsma.js';

const fyStartUTC = (fy: number) => new Date(Date.UTC(fy - 1, 9, 1));

/**
 * Seeds/updates US-wide surcharges:
 * - MPF (rate + FY min/max from Federal Register)  [ALL modes]
 * - HMF (ocean-only)                                [OCEAN]
 * - APHIS AQI user fees                             [mode + per-unit]
 * - FDA VQIP/FSMA program fees                      [program-level]
 * - (Optional) HTS Trade Remedy summary rows        [program-level, ad valorem]
 *
 * Flags:
 *   --fy=2026        Override fiscal year (default = current FY)
 *   --batch=5000     Batch size for upserts
 *   --no-aphis       Skip APHIS module
 *   --no-fda         Skip FDA module
 *   --no-tr          Skip HTS trade-remedy summary rows
 */
export const surchargesUsAll: Command = async (args) => {
  const flags = parseFlags(args);
  const fy = flags.fy ? Number(flags.fy) : fiscalYear(new Date());
  const batchSize =
    flags.batch != null
      ? Number(flags.batch)
      : process.env.BATCH_SIZE
        ? Number(process.env.BATCH_SIZE)
        : undefined;

  const run = await withRun(
    { importSource: 'US', job: 'surcharges:us-all', params: { fy, batchSize } },
    async (importId: string) => {
      const results: Record<string, unknown> = {};
      let inserted = 0;

      // 1) CBP base (MPF/HMF), with automatic carry-forward/FR parsing + closeout at FY start
      const base = await upsertUSBaseSurcharges({ fy, importId });
      inserted += base?.count ?? 0;
      results.base = base;

      // 2) APHIS AQI (unless skipped)
      if (!('noAphis' in flags) && !('no-aphis' in flags)) {
        const aphis = await importAphisAqiSurcharges({
          fiscalYear: fy,
          effectiveFrom: fyStartUTC(fy),
          batchSize,
          importId,
        } as any);
        inserted += aphis?.count ?? 0;
        results.aphis = aphis;
      }

      // 3) FDA VQIP/FSMA (unless skipped)
      if (!('noFda' in flags) && !('no-fda' in flags)) {
        const fda = await importFdaFsmaSurcharges({
          fiscalYear: fy,
          effectiveFrom: fyStartUTC(fy),
          batchSize,
          importId,
        } as any);
        inserted += fda?.count ?? 0;
        results.fda = fda;
      }

      // 4) HTS trade-remedy summary rows (optional; these are ad valorem program rows)
      if (!('noTr' in flags) && !('no-tr' in flags)) {
        const tr = await importUsTradeRemediesFromHTS({
          effectiveFrom: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)),
          skipFree: true,
          batchSize,
          importId,
        } as any);
        inserted += tr?.count ?? 0;
        results.tradeRemedies = tr;
      }

      return { inserted, payload: results };
    }
  );

  console.log(run);
};

/**
 * Standalone job for HTS trade remedies (kept for convenience).
 */
export const surchargesUsTradeRemedies: Command = async (args) => {
  const flags = parseFlags(args);
  const effectiveFrom = flags.effectiveFrom
    ? new Date(`${flags.effectiveFrom}T00:00:00Z`)
    : undefined;
  const skipFree =
    typeof flags.skipFree === 'string' && /^(1|true|yes)$/i.test(flags.skipFree.trim());

  const payload = await withRun(
    {
      importSource: 'USITC_HTS',
      job: 'surcharges:us-trade-remedies',
      params: { effectiveFrom, skipFree },
    },
    async (importId: string) => {
      const res = await importUsTradeRemediesFromHTS({ effectiveFrom, skipFree, importId } as any);
      const inserted = res?.count ?? 0;
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};

export const surchargesUsAphis: Command = async () => {
  const payload = await withRun(
    { importSource: 'APHIS', job: 'surcharges:us-aphis' },
    async (id /* importId: string */) => {
      const res = await importAphisAqiSurcharges({ importId: id });
      const inserted = res?.count ?? 0;
      return { inserted, payload: res };
    }
  );
  console.log(payload);
};

export const surchargesUsFda: Command = async () => {
  const payload = await withRun(
    { importSource: 'FDA', job: 'surcharges:us-fda' },
    async (id /* importId: string */) => {
      const res = await importFdaFsmaSurcharges({ importId: id });
      const inserted = res?.count ?? 0;
      return { inserted, payload: res };
    }
  );
  console.log(payload);
};
