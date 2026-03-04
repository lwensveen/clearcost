import { importAseanPreferentialOfficialFromExcel } from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { importMxMfnOfficial } from '../../../../modules/duty-rates/services/mx/import-mfn-official.js';
import {
  MX_FTA_OFFICIAL_SOURCE_KEY,
  MX_MFN_OFFICIAL_SOURCE_KEY,
  resolveMxDutySourceUrls,
} from '../../../../modules/duty-rates/services/mx/source-urls.js';
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

async function runMxMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const mfnUrlOverride = flagStr(flags, 'url');
  const { mfnUrl } = await resolveMxDutySourceUrls({ mfnUrl: mfnUrlOverride });

  if (!mfnUrl) {
    throw new Error(
      'MX MFN source URL is required. Provide --url=<source> or configure duties.mx.official.mfn_excel / MX_MFN_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:mx-mfn-official',
      sourceKey: MX_MFN_OFFICIAL_SOURCE_KEY,
      sourceUrl: mfnUrl,
      params: {
        url: mfnUrl,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: MX_MFN_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importMxMfnOfficial({
        urlOrPath: mfnUrl,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
      return { inserted: result.inserted, payload: result };
    }
  );

  console.log({ step: 'mx-mfn-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runMxFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const ftaUrlOverride = flagStr(flags, 'url');
  const { ftaUrl } = await resolveMxDutySourceUrls({ ftaUrl: ftaUrlOverride });

  if (!ftaUrl) {
    throw new Error(
      'MX FTA source URL is required. Provide --url=<source> or configure duties.mx.official.fta_excel / MX_FTA_OFFICIAL_EXCEL_URL.'
    );
  }

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:mx-fta-official',
      sourceKey: MX_FTA_OFFICIAL_SOURCE_KEY,
      sourceUrl: ftaUrl,
      params: {
        url: ftaUrl,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: MX_FTA_OFFICIAL_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'MX',
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

  console.log({ step: 'mx-fta-official', ...step });
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesMxMfnOfficial: Command = async (args) => {
  const totals = await runMxMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesMxFtaOfficial: Command = async (args) => {
  const totals = await runMxFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesMxAllOfficial: Command = async (args) => {
  const mfn = await runMxMfnOfficial(args);
  const fta = await runMxFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
