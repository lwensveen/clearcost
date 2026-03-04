import { importAseanPreferentialOfficialFromExcel } from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { importSkMfnOfficial } from '../../../../modules/duty-rates/services/sk/import-mfn-official.js';
import {
  SK_FTA_OFFICIAL_SOURCE_KEY,
  SK_MFN_OFFICIAL_SOURCE_KEY,
  resolveSkDutySourceUrls,
} from '../../../../modules/duty-rates/services/sk/source-urls.js';
import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { flagBool, flagNum, flagStr, parseFlags } from '../../utils.js';

type ImportTotals = {
  count: number;
  inserted: number;
  updated: number;
};

function maybeSheet(value: string | undefined): string | number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

function addTotals(
  target: ImportTotals,
  step: { count?: number; inserted?: number; updated?: number }
) {
  target.count += step.count ?? 0;
  target.inserted += step.inserted ?? 0;
  target.updated += step.updated ?? 0;
}

async function runSkMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const mfnUrlOverride = flagStr(flags, 'url');
  const { mfnUrl } = await resolveSkDutySourceUrls({ mfnUrl: mfnUrlOverride });

  if (!mfnUrl) {
    throw new Error(
      'SK MFN source URL is required. Provide --url=<source> or configure duties.sk.official.mfn_excel / SK_MFN_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:sk-mfn-official',
      sourceKey: SK_MFN_OFFICIAL_SOURCE_KEY,
      sourceUrl: mfnUrl,
      params: {
        url: mfnUrl,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: SK_MFN_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importSkMfnOfficial({
        urlOrPath: mfnUrl,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'sk-mfn-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runSkFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const ftaUrlOverride = flagStr(flags, 'url');
  const { ftaUrl } = await resolveSkDutySourceUrls({ ftaUrl: ftaUrlOverride });

  if (!ftaUrl) {
    throw new Error(
      'SK FTA source URL is required. Provide --url=<source> or configure duties.sk.official.fta_excel / SK_FTA_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:sk-fta-official',
      sourceKey: SK_FTA_OFFICIAL_SOURCE_KEY,
      sourceUrl: ftaUrl,
      params: {
        url: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: SK_FTA_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'SK',
        urlOrPath: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'sk-fta-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesSkMfnOfficial: Command = async (args) => {
  const totals = await runSkMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesSkFtaOfficial: Command = async (args) => {
  const totals = await runSkFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesSkAllOfficial: Command = async (args) => {
  const mfn = await runSkMfnOfficial(args);
  const fta = await runSkFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
