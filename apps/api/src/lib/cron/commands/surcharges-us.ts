import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { importAllUsSurcharges } from '../../../modules/surcharges/services/us/import-all.js';
import { importUsTradeRemediesFromHTS } from '../../../modules/surcharges/services/us/import-usitc-hts.js';

export const surchargesUsAll: Command = async () => {
  const payload = await withRun({ source: 'US', job: 'surcharges:us-all' }, async () => {
    const batchSize = process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : undefined;
    const res = await importAllUsSurcharges({ batchSize });
    const inserted = res?.count ?? res?.count ?? 0;

    return { inserted, payload: res };
  });
  console.log(payload);
};

export const surchargesUsTradeRemedies: Command = async (args) => {
  const flags = parseFlags(args);
  const effectiveFrom = flags.effectiveFrom
    ? new Date(`${flags.effectiveFrom}T00:00:00Z`)
    : undefined;
  const skipFree =
    typeof flags.skipFree === 'string' && /^(1|true|yes)$/i.test(flags.skipFree.trim());

  const payload = await withRun(
    {
      source: 'USITC_HTS',
      job: 'surcharges:us-trade-remedies',
      params: { effectiveFrom, skipFree },
    },
    async () => {
      const res = await importUsTradeRemediesFromHTS({ effectiveFrom, skipFree });
      const inserted = res?.count ?? 0;

      return { inserted, payload: res };
    }
  );
  console.log(payload);
};
