import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { importDutyRatesFromWITS } from '../../../modules/duty-rates/services/wits/import-from-wits.js';
import { buildImportId, parseCSV, parseFlags } from '../utils.js';

const DEFAULT_DESTS = [
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
  'EU',
] as const;

export const dutiesWits: Command = async (args) => {
  const flags = parseFlags(args.slice(0)); // keep all flags

  // --dests=US,GB or positional first arg (legacy)
  const destsArg = (flags.dests ?? args[0] ?? '') as string | boolean;
  const wantAll =
    destsArg === true || // bare --dests
    (typeof destsArg === 'string' && destsArg.trim().toUpperCase() === 'ALL') ||
    (!destsArg && process.env.WITS_ALLOW_ALL === '1');

  const dests: string[] = wantAll
    ? [...DEFAULT_DESTS]
    : parseCSV(typeof destsArg === 'string' ? destsArg : '')
        .map((s) => s.toUpperCase())
        .filter(Boolean);

  // partners (optional)
  const partners = parseCSV(flags.partners as string | undefined)
    .map((s) => s.toUpperCase())
    .filter(Boolean);

  const year = flags.year ? Number(flags.year) : undefined;
  const backfillYears = flags.backfill ? Number(flags.backfill) : 1;
  const concurrency = flags.concurrency ? Number(flags.concurrency) : 3;
  const batchSize = flags.batch ? Number(flags.batch) : 5000;
  const hs6List = parseCSV(flags.hs6 as string | undefined).map((s) => s.slice(0, 6));

  const importId =
    (flags.importId as string | undefined) ??
    buildImportId('duties:wits', [
      wantAll ? `ALL(${dests.length})` : dests.join('+'),
      partners.length ? `p=${partners.join('+')}` : undefined,
      String(year ?? new Date().getUTCFullYear() - 1),
      new Date().toISOString(),
    ]);

  if (process.env.DEBUG === '1' || args.includes('--debug')) {
    console.log('[duties:wits] plan', {
      totalDests: dests.length,
      sample: dests.slice(0, 10),
      partners,
      year,
      backfillYears,
      concurrency,
      batchSize,
      hs6List: hs6List.length ? hs6List : undefined,
      importId,
      wantAll,
      exclude: [],
    });
  }

  const payload = await withRun(
    {
      importSource: 'WITS',
      job: 'duties:wits',
      params: { dests, partners, year, backfillYears, concurrency, batchSize, hs6List },
    },
    async (runId) => {
      const res = await importDutyRatesFromWITS({
        dests: dests.length ? dests : [...DEFAULT_DESTS],
        partners,
        year,
        backfillYears,
        concurrency,
        batchSize,
        hs6List: hs6List.length ? hs6List : undefined,
        importId: runId,
        makeSourceRef: (r) => {
          const ef = r.effectiveFrom
            ? new Date(r.effectiveFrom).toISOString().slice(0, 10)
            : 'unknown';
          const partner = r.partner && r.partner !== '' ? r.partner : 'ERGA';
          const rule = r.dutyRule ?? 'mfn';
          return `wits:${r.dest}:${partner}:${rule}:hs6=${r.hs6}:ef=${ef}`;
        },
      });

      const inserted = res?.inserted ?? 0;
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
