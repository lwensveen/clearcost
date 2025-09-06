import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importJpMfn } from '../../../../modules/duty-rates/services/jp/import-mfn.js';
import { importJpPreferential } from '../../../../modules/duty-rates/services/jp/import-preferential.js';

const boolParam = (b?: boolean) => (b ? '1' : undefined);

export const dutiesJpMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',') : undefined;
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun(
    {
      importSource: 'JP_CUSTOMS',
      job: 'duties:jp-mfn',
      params: { hs6, dryRun: boolParam(dryRun) },
    },
    async (importId) => {
      const res = await importJpMfn({ hs6List: hs6, dryRun, importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesJpFta: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',') : undefined;
  const partnerGeoIds = flags.partners ? String(flags.partners).split(',') : undefined;
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun(
    {
      importSource: 'WITS',
      job: 'duties:jp-fta',
      params: { hs6, partners: partnerGeoIds, dryRun: boolParam(dryRun) },
    },
    async (importId) => {
      const res = await importJpPreferential({ hs6List: hs6, partnerGeoIds, dryRun, importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesJpAll: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',') : undefined;
  const partners = flags.partners ? String(flags.partners).split(',') : undefined;
  const dryRun = Boolean(flags.dryRun);

  const mfn = await withRun(
    {
      importSource: 'JP_CUSTOMS',
      job: 'duties:jp-mfn',
      params: { hs6, dryRun: boolParam(dryRun) },
    },
    async (importId) => {
      const res = await importJpMfn({ hs6List: hs6, dryRun, importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log({ step: 'jp-mfn', ...mfn });

  const fta = await withRun(
    {
      importSource: 'WITS',
      job: 'duties:jp-fta',
      params: { hs6, partners, dryRun: boolParam(dryRun) },
    },
    async (importId) => {
      const res = await importJpPreferential({
        hs6List: hs6,
        partnerGeoIds: partners,
        dryRun,
        importId,
      });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log({ step: 'jp-fta', ...fta });

  console.log({
    ok: true,
    count: (mfn.count ?? 0) + (fta.count ?? 0),
    inserted: (mfn.inserted ?? 0) + (fta.inserted ?? 0),
    updated: (mfn.updated ?? 0) + (fta.updated ?? 0),
  });
};
