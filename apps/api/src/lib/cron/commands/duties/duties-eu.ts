import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { parseDateMaybe } from '../../../parse-date-maybe.js';
import { importEuFromDaily } from '../../../../modules/duty-rates/services/eu/import-daily.js';
import { importEuMfn } from '../../../../modules/duty-rates/services/eu/import-mfn.js';
import { importEuPreferential } from '../../../../modules/duty-rates/services/eu/import-preferential.js';

export const dutiesEuDaily: Command = async (args) => {
  const flags = parseFlags(args);
  const dateArg = flags.date ?? flags.effectiveFrom ?? args?.[0];

  const payload = await withRun(
    { importSource: 'TARIC', job: 'duties:eu-daily', params: { date: dateArg } },
    async (importId) => {
      const res = await importEuFromDaily({ date: dateArg, include: 'both', importId });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesEuMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = (flags.hs6 ?? '').split(',').filter(Boolean);

  const payload = await withRun(
    { importSource: 'TARIC', job: 'duties:eu-mfn', params: { hs6 } },
    async (importId) => {
      const res = await importEuMfn({ hs6List: hs6.length ? hs6 : undefined, importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesEuFta: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = (flags.hs6 ?? '').split(',').filter(Boolean);
  const partnerGeoIds = (flags.partners ?? '').split(',').filter(Boolean);

  const payload = await withRun(
    { importSource: 'TARIC', job: 'duties:eu-fta', params: { hs6, partnerGeoIds } },
    async (importId) => {
      const res = await importEuPreferential({
        hs6List: hs6.length ? hs6 : undefined,
        partnerGeoIds: partnerGeoIds.length ? partnerGeoIds : undefined,
        importId,
      });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesEuBackfill: Command = async (args) => {
  const flags = parseFlags(args);
  const fromArg = flags.from ?? args?.[0];
  const toArg = flags.to ?? args?.[1] ?? flags.until;
  const from = parseDateMaybe(fromArg);
  const to = parseDateMaybe(toArg);
  if (!from || !to) throw new Error('Provide --from=YYYY-MM-DD and --to=YYYY-MM-DD');

  // inclusive date loop
  const days: string[] = [];
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1))
    days.push(d.toISOString().slice(0, 10));

  let inserted = 0,
    updated = 0,
    count = 0;
  for (const day of days) {
    const step = await withRun(
      { importSource: 'TARIC', job: 'duties:eu-daily', params: { date: day } },
      async (importId) => {
        const res = await importEuFromDaily({ date: day, include: 'both', importId });
        return { inserted: res.inserted, payload: res };
      }
    );
    console.log({ step: 'eu-daily', date: day, ...step });
    inserted += step.inserted ?? 0;
    updated += step.updated ?? 0;
    count += step.count ?? 0;
  }
  console.log({ ok: true, count, inserted, updated, days: days.length });
};
