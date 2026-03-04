import { importAseanPreferentialOfficialFromExcel } from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { importCoMfnOfficial } from '../../../../modules/duty-rates/services/co/import-mfn-official.js';
import {
  CO_FTA_OFFICIAL_SOURCE_KEY,
  CO_MFN_OFFICIAL_SOURCE_KEY,
  resolveCoDutySourceUrls,
} from '../../../../modules/duty-rates/services/co/source-urls.js';
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

async function runCoMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const mfnUrlOverride = flagStr(flags, 'url');
  const { mfnUrl } = await resolveCoDutySourceUrls({ mfnUrl: mfnUrlOverride });

  if (!mfnUrl) {
    throw new Error(
      'CO MFN source URL is required. Provide --url=<source> or configure duties.co.official.mfn_excel / CO_MFN_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:co-mfn-official',
      sourceKey: CO_MFN_OFFICIAL_SOURCE_KEY,
      sourceUrl: mfnUrl,
      params: {
        url: mfnUrl,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: CO_MFN_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importCoMfnOfficial({
        urlOrPath: mfnUrl,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'co-mfn-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runCoFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const ftaUrlOverride = flagStr(flags, 'url');
  const { ftaUrl } = await resolveCoDutySourceUrls({ ftaUrl: ftaUrlOverride });

  if (!ftaUrl) {
    throw new Error(
      'CO FTA source URL is required. Provide --url=<source> or configure duties.co.official.fta_excel / CO_FTA_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:co-fta-official',
      sourceKey: CO_FTA_OFFICIAL_SOURCE_KEY,
      sourceUrl: ftaUrl,
      params: {
        url: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: CO_FTA_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'CO',
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

  console.log({ step: 'co-fta-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesCoMfnOfficial: Command = async (args) => {
  const totals = await runCoMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesCoFtaOfficial: Command = async (args) => {
  const totals = await runCoFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesCoAllOfficial: Command = async (args) => {
  const mfn = await runCoMfnOfficial(args);
  const fta = await runCoFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
