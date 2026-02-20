import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { importUsMfn } from '../../../../modules/duty-rates/services/us/import-mfn.js';
import { importUsPreferential } from '../../../../modules/duty-rates/services/us/import-preferential.js';
import { parseDateMaybe } from '../../../parse-date-maybe.js';
import { parseFlags } from '../../utils.js';

const boolParam = (b?: boolean) => (b ? '1' : undefined);

/**
 * MFN (Column 1 "General") duties
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-mfn
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-mfn --date=2025-01-01
 */
export const dutiesUsMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const dateArg = flags.date ?? flags.effectiveFrom ?? args?.[0];
  const effectiveFrom = parseDateMaybe(dateArg);

  const payload = await withRun(
    {
      importSource: 'USITC_HTS',
      job: 'duties:us-mfn',
      params: { effectiveFrom: dateArg },
    },
    async () => {
      const res = await importUsMfn({ effectiveFrom });
      return {
        inserted: res.inserted ?? 0,
        updated: res.updated ?? 0,
        count: res.count ?? (res.inserted ?? 0) + (res.updated ?? 0),
        payload: res,
      };
    }
  );

  console.log(payload);
};

/**
 * Preferential/FTA (Column 1 "Special") duties
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-fta
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-fta --date=2025-01-01
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-fta --skipFree
 */
export const dutiesUsFta: Command = async (args) => {
  const flags = parseFlags(args);
  const dateArg = flags.date ?? flags.effectiveFrom ?? args?.[0];
  const effectiveFrom = parseDateMaybe(dateArg);
  const skipFree = Boolean(flags.skipFree);

  const payload = await withRun(
    {
      importSource: 'USITC_HTS',
      job: 'duties:us-fta',
      params: { effectiveFrom: dateArg, skipFree: boolParam(skipFree) },
    },
    async () => {
      const res = await importUsPreferential({ effectiveFrom, skipFree });
      return {
        inserted: res.inserted ?? 0,
        updated: res.updated ?? 0,
        count: res.count ?? (res.inserted ?? 0) + (res.updated ?? 0),
        payload: res,
      };
    }
  );

  console.log(payload);
};

/**
 * Convenience: run MFN then FTA back-to-back
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-all
 *   bun run --cwd apps/api src/lib/cron/index.ts import:duties:us-all --date=2025-01-01 --skipFree
 */
export const dutiesUsAll: Command = async (args) => {
  const flags = parseFlags(args);
  const dateArg = flags.date ?? flags.effectiveFrom ?? args?.[0];
  const effectiveFrom = parseDateMaybe(dateArg);
  const skipFree = Boolean(flags.skipFree);

  // MFN
  const mfn = await withRun(
    {
      importSource: 'USITC_HTS',
      job: 'duties:us-mfn',
      params: { effectiveFrom: dateArg },
    },
    async () => {
      const res = await importUsMfn({ effectiveFrom });
      return {
        inserted: res.inserted ?? 0,
        updated: res.updated ?? 0,
        count: res.count ?? (res.inserted ?? 0) + (res.updated ?? 0),
        payload: res,
      };
    }
  );
  console.log({ step: 'us-mfn', ...mfn });

  // FTA
  const fta = await withRun(
    {
      importSource: 'USITC_HTS',
      job: 'duties:us-fta',
      params: { effectiveFrom: dateArg, skipFree: boolParam(skipFree) },
    },
    async () => {
      const res = await importUsPreferential({ effectiveFrom, skipFree });
      return {
        inserted: res.inserted ?? 0,
        updated: res.updated ?? 0,
        count: res.count ?? (res.inserted ?? 0) + (res.updated ?? 0),
        payload: res,
      };
    }
  );
  console.log({ step: 'us-fta', ...fta });

  // Combined summary
  console.log({
    ok: true,
    count: (mfn.count ?? 0) + (fta.count ?? 0),
    inserted: (mfn.inserted ?? 0) + (fta.inserted ?? 0),
    updated: (mfn.updated ?? 0) + (fta.updated ?? 0),
  });
};
