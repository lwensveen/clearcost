import type { Command } from '../runtime.js';
import { buildImportId, parseCSV, parseFlags, withRun } from '../runtime.js';
import { importDutyRatesFromWITS } from '../../../modules/duty-rates/services/wits/import-from-wits.js';

export const dutiesWits: Command = async (args) => {
  const list = (args[0] ?? '').trim();
  if (!list) throw new Error('Pass comma-separated ISO2 list, e.g., "US,GB,TH"');

  const dests = parseCSV(list).map((s) => s.toUpperCase());
  const flags = parseFlags(args.slice(1));
  const year = flags.year ? Number(flags.year) : undefined;
  const partners = parseCSV(flags.partners).map((s) => s.toUpperCase());
  const backfillYears = flags.backfill ? Number(flags.backfill) : 1;
  const concurrency = flags.concurrency ? Number(flags.concurrency) : 3;
  const batchSize = flags.batch ? Number(flags.batch) : 5000;
  const hs6List = parseCSV(flags.hs6).map((s) => s.slice(0, 6));

  const importId =
    flags.importId ||
    buildImportId('duties:wits', [
      dests.join('+'),
      partners.length ? `p=${partners.join('+')}` : undefined,
      year ?? new Date().getUTCFullYear() - 1,
    ]);

  const payload = await withRun<any>(
    {
      importSource: 'WITS',
      job: 'duties:wits',
      params: { dests, partners, year, backfillYears, concurrency, batchSize, hs6List },
    },
    async () => {
      const res = await importDutyRatesFromWITS({
        dests,
        partners,
        year,
        backfillYears,
        concurrency,
        batchSize,
        hs6List: hs6List.length ? hs6List : undefined,
        importId,
        makeSourceRef: ({ dest, hs6, dutyRule, effectiveFrom }) =>
          `wits:${dest}:${dutyRule}:${hs6}:${String(effectiveFrom).slice(0, 10)}`,
      });
      const inserted = res?.inserted ?? 0;

      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
