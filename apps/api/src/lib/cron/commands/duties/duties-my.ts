import { importMyPreferential } from '../../../../modules/duty-rates/services/asean/my/import-preferential.js';
import { Command, withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importMyMfn } from '../../../../modules/duty-rates/services/asean/my/import-mfn.js';

export const dutiesMyMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = (flags.hs6 as string | undefined)?.split(',').filter(Boolean);

  const payload = await withRun(
    {
      importSource: 'WITS',
      job: 'duties:my-mfn',
      params: { hs6, sourceKey: 'duties.wits.sdmx.base' },
    },
    async (importId) => {
      const res = await importMyMfn({
        hs6List: hs6,
        batchSize: flags.batchSize ? Number(flags.batchSize) : undefined,
        dryRun: Boolean(flags.dryRun),
        importId,
      });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

// FTA
export const dutiesMyFta: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = (flags.hs6 as string | undefined)?.split(',').filter(Boolean);
  const partners = (flags.partners as string | undefined)?.split(',').filter(Boolean);

  const payload = await withRun(
    {
      importSource: 'WITS',
      job: 'duties:my-fta',
      params: { hs6, partners, sourceKey: 'duties.wits.sdmx.base' },
    },
    async (importId) => {
      const res = await importMyPreferential({
        hs6List: hs6,
        partnerGeoIds: partners,
        batchSize: flags.batchSize ? Number(flags.batchSize) : undefined,
        dryRun: Boolean(flags.dryRun),
        importId,
      });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesMyAll: Command = async (args) => {
  await dutiesMyMfn(args);
  await dutiesMyFta(args);
};
