import { importAseanPreferentialOfficialFromExcel } from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { importNlMfnOfficial } from '../../../../modules/duty-rates/services/nl/import-mfn-official.js';
import {
  NL_FTA_OFFICIAL_SOURCE_KEY,
  NL_MFN_OFFICIAL_SOURCE_KEY,
  resolveNlDutySourceUrls,
} from '../../../../modules/duty-rates/services/nl/source-urls.js';
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

async function runNlMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const mfnUrlOverride = flagStr(flags, 'url');
  const { mfnUrl } = await resolveNlDutySourceUrls({ mfnUrl: mfnUrlOverride });

  if (!mfnUrl) {
    throw new Error(
      'NL MFN source URL is required. Provide --url=<source> or configure duties.nl.official.mfn_excel / NL_MFN_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:nl-mfn-official',
      sourceKey: NL_MFN_OFFICIAL_SOURCE_KEY,
      sourceUrl: mfnUrl,
      params: {
        url: mfnUrl,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: NL_MFN_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importNlMfnOfficial({
        urlOrPath: mfnUrl,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'nl-mfn-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runNlFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const ftaUrlOverride = flagStr(flags, 'url');
  const { ftaUrl } = await resolveNlDutySourceUrls({ ftaUrl: ftaUrlOverride });

  if (!ftaUrl) {
    throw new Error(
      'NL FTA source URL is required. Provide --url=<source> or configure duties.nl.official.fta_excel / NL_FTA_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:nl-fta-official',
      sourceKey: NL_FTA_OFFICIAL_SOURCE_KEY,
      sourceUrl: ftaUrl,
      params: {
        url: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: NL_FTA_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'NL',
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

  console.log({ step: 'nl-fta-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesNlMfnOfficial: Command = async (args) => {
  const totals = await runNlMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesNlFtaOfficial: Command = async (args) => {
  const totals = await runNlFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesNlAllOfficial: Command = async (args) => {
  const mfn = await runNlMfnOfficial(args);
  const fta = await runNlFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
