import { resolveAseanDutySourceUrl } from '../../../../modules/duty-rates/services/asean/source-urls.js';
import {
  importAseanMfnOfficialFromExcel,
  type ImportAseanMfnOfficialExcelOptions,
} from '../../../../modules/duty-rates/services/asean/shared/import-mfn-official-excel.js';
import {
  importAseanPreferentialOfficialFromExcel,
  type ImportAseanPreferentialOfficialExcelOptions,
} from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { flagBool, flagNum, flagStr, parseFlags } from '../../utils.js';

type ImportTotals = {
  count: number;
  inserted: number;
  updated: number;
};

const DUTIES_KR_MFN_SOURCE_KEY = 'duties.kr.official.mfn_excel';
const DUTIES_KR_FTA_SOURCE_KEY = 'duties.kr.official.fta_excel';

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

async function runKrMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const fallbackUrl = flagStr(flags, 'url');

  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_KR_MFN_SOURCE_KEY,
    fallbackUrl,
  });

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:kr-mfn-official',
      sourceKey: DUTIES_KR_MFN_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: DUTIES_KR_MFN_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanMfnOfficialFromExcel({
        dest: 'KR',
        urlOrPath,
        sheet,
        batchSize,
        dryRun,
        importId,
      } satisfies ImportAseanMfnOfficialExcelOptions);
      return { inserted: result.inserted, payload: result };
    }
  );
  console.log({ step: 'kr-mfn-official', ...step });

  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

async function runKrFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const fallbackUrl = flagStr(flags, 'url');

  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_KR_FTA_SOURCE_KEY,
    fallbackUrl,
  });

  const step = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:kr-fta-official',
      sourceKey: DUTIES_KR_FTA_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet,
        agreement,
        partner,
        batchSize,
        dryRun: dryRun ? '1' : undefined,
        sourceKey: DUTIES_KR_FTA_SOURCE_KEY,
      },
    },
    async (importId) => {
      const result = await importAseanPreferentialOfficialFromExcel({
        dest: 'KR',
        urlOrPath,
        agreement,
        partner,
        sheet,
        batchSize,
        dryRun,
        importId,
      } satisfies ImportAseanPreferentialOfficialExcelOptions);
      return { inserted: result.inserted, payload: result };
    }
  );
  console.log({ step: 'kr-fta-official', ...step });

  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };
  addTotals(totals, step);
  return totals;
}

export const dutiesKrMfnOfficial: Command = async (args) => {
  const totals = await runKrMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesKrFtaOfficial: Command = async (args) => {
  const totals = await runKrFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesKrAllOfficial: Command = async (args) => {
  const mfn = await runKrMfnOfficial(args);
  const fta = await runKrFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
