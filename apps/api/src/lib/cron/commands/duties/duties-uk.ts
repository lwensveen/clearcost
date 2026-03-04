import { batchUpsertDutyRatesFromStream } from '../../../../modules/duty-rates/utils/batch-upsert.js';
import { streamUkMfnDutyRates } from '../../../../modules/duty-rates/services/uk/mfn.js';
import { streamUkPreferentialDutyRates } from '../../../../modules/duty-rates/services/uk/preferential.js';
import { resolveUkTariffDutySourceUrls } from '../../../../modules/duty-rates/services/uk/source-urls.js';
import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';

const DUTIES_UK_SOURCE_KEY = 'duties.uk.tariff.api_base';
const boolParam = (b?: boolean) => (b ? '1' : undefined);

export const dutiesUkMfnOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',').filter(Boolean) : undefined;
  const batchSize = flags.batchSize ? Number(flags.batchSize) : undefined;
  const dryRun = Boolean(flags.dryRun);
  const apiBaseUrl = flags.apiBaseUrl ? String(flags.apiBaseUrl) : undefined;
  const source = await resolveUkTariffDutySourceUrls({ apiBaseUrl });

  const payload = await withRun(
    {
      importSource: 'UK_TT',
      job: 'duties:uk-mfn-official',
      sourceKey: DUTIES_UK_SOURCE_KEY,
      sourceUrl: source.apiBaseUrl,
      params: {
        hs6,
        batchSize,
        dryRun: boolParam(dryRun),
        apiBaseUrl: source.apiBaseUrl,
        sourceKey: DUTIES_UK_SOURCE_KEY,
      },
    },
    async (importId, sourceKey) => {
      const res = await batchUpsertDutyRatesFromStream(
        streamUkMfnDutyRates({ hs6List: hs6, apiBaseUrl: source.apiBaseUrl }),
        {
          batchSize,
          dryRun,
          importId,
          sourceKey,
          makeSourceRef: (row) => `uk:tt:erga-omnes:hs6=${row.hs6}`,
        }
      );
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesUkFtaOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',').filter(Boolean) : undefined;
  const partners = flags.partners ? String(flags.partners).split(',').filter(Boolean) : undefined;
  const batchSize = flags.batchSize ? Number(flags.batchSize) : undefined;
  const dryRun = Boolean(flags.dryRun);
  const apiBaseUrl = flags.apiBaseUrl ? String(flags.apiBaseUrl) : undefined;
  const source = await resolveUkTariffDutySourceUrls({ apiBaseUrl });

  const payload = await withRun(
    {
      importSource: 'UK_TT',
      job: 'duties:uk-fta-official',
      sourceKey: DUTIES_UK_SOURCE_KEY,
      sourceUrl: source.apiBaseUrl,
      params: {
        hs6,
        partners,
        batchSize,
        dryRun: boolParam(dryRun),
        apiBaseUrl: source.apiBaseUrl,
        sourceKey: DUTIES_UK_SOURCE_KEY,
      },
    },
    async (importId, sourceKey) => {
      const res = await batchUpsertDutyRatesFromStream(
        streamUkPreferentialDutyRates({
          hs6List: hs6,
          partners,
          apiBaseUrl: source.apiBaseUrl,
        }),
        {
          batchSize,
          dryRun,
          importId,
          sourceKey,
          makeSourceRef: (row) => `uk:tt:pref:partner=${row.partner ?? 'group'}:hs6=${row.hs6}`,
        }
      );
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesUkAllOfficial: Command = async (args) => {
  await dutiesUkMfnOfficial(args);
  await dutiesUkFtaOfficial(args);
};
