import { importAseanPreferentialOfficialFromExcel } from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { importNzMfnOfficial } from '../../../../modules/duty-rates/services/nz/import-mfn-official.js';
import {
  NZ_FTA_OFFICIAL_SOURCE_KEY,
  NZ_MFN_OFFICIAL_SOURCE_KEY,
  resolveNzDutySourceUrls,
} from '../../../../modules/duty-rates/services/nz/source-urls.js';
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

async function runNzMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const mfnUrlOverride = flagStr(flags, 'url');
  const { mfnUrl } = await resolveNzDutySourceUrls({ mfnUrl: mfnUrlOverride });

  if (!mfnUrl) {
    throw new Error(
      'NZ MFN source URL is required. Provide --url=<source> or configure duties.nz.official.mfn_excel / NZ_MFN_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:nz-mfn-official',
      sourceKey: NZ_MFN_OFFICIAL_SOURCE_KEY,
      sourceUrl: mfnUrl,
      params: {
        url: mfnUrl,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: NZ_MFN_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importNzMfnOfficial({
        urlOrPath: mfnUrl,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'nz-mfn-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runNzFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const ftaUrlOverride = flagStr(flags, 'url');
  const { ftaUrl } = await resolveNzDutySourceUrls({ ftaUrl: ftaUrlOverride });

  if (!ftaUrl) {
    throw new Error(
      'NZ FTA source URL is required. Provide --url=<source> or configure duties.nz.official.fta_excel / NZ_FTA_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:nz-fta-official',
      sourceKey: NZ_FTA_OFFICIAL_SOURCE_KEY,
      sourceUrl: ftaUrl,
      params: {
        url: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: NZ_FTA_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'NZ',
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

  console.log({ step: 'nz-fta-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesNzMfnOfficial: Command = async (args) => {
  const totals = await runNzMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesNzFtaOfficial: Command = async (args) => {
  const totals = await runNzFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesNzAllOfficial: Command = async (args) => {
  const mfn = await runNzMfnOfficial(args);
  const fta = await runNzFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
