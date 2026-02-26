import {
  importMyPreferentialFromExcel,
  type ImportMyPreferentialParams,
} from '../../../../modules/duty-rates/services/asean/my/import-preferential-excel.js';
import {
  importMyMfnFromExcel,
  type ImportMyMfnOptions,
} from '../../../../modules/duty-rates/services/asean/my/import-mfn-excel.js';
import { resolveAseanDutySourceUrl } from '../../../../modules/duty-rates/services/asean/source-urls.js';
import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { flagBool, flagNum, flagStr, parseFlags } from '../../utils.js';

const DUTIES_MY_MFN_SOURCE_KEY = 'duties.my.official.mfn_excel';
const DUTIES_MY_FTA_SOURCE_KEY = 'duties.my.official.fta_excel';

function maybeSheet(value: string | undefined): string | number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

function parseMfnOptions(args: string[]): {
  urlOrPath: string;
  sheet?: string | number;
  batchSize?: number;
  dryRun: boolean;
} {
  const flags = parseFlags(args);
  const fallbackUrl = flagStr(flags, 'url') ?? process.env.MY_MFN_OFFICIAL_EXCEL_URL;
  return {
    urlOrPath: fallbackUrl ?? '',
    sheet: maybeSheet(flagStr(flags, 'sheet')),
    batchSize: flagNum(flags, 'batchSize'),
    dryRun: flagBool(flags, 'dryRun'),
  };
}

function parseFtaOptions(args: string[]): {
  urlOrPath: string;
  sheet?: string | number;
  agreement?: string;
  partner?: string;
  batchSize?: number;
  dryRun: boolean;
} {
  const flags = parseFlags(args);
  const fallbackUrl = flagStr(flags, 'url') ?? process.env.MY_FTA_OFFICIAL_EXCEL_URL;
  return {
    urlOrPath: fallbackUrl ?? '',
    sheet: maybeSheet(flagStr(flags, 'sheet')),
    agreement: flagStr(flags, 'agreement'),
    partner: flagStr(flags, 'partner'),
    batchSize: flagNum(flags, 'batchSize'),
    dryRun: flagBool(flags, 'dryRun'),
  };
}

export const dutiesMyMfnOfficial: Command = async (args) => {
  const options = parseMfnOptions(args);
  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_MY_MFN_SOURCE_KEY,
    fallbackUrl: options.urlOrPath || undefined,
  });

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:my-mfn-official',
      sourceKey: DUTIES_MY_MFN_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet: options.sheet,
        batchSize: options.batchSize,
        dryRun: options.dryRun ? '1' : undefined,
        sourceKey: DUTIES_MY_MFN_SOURCE_KEY,
      },
    },
    async (importId) => {
      const res = await importMyMfnFromExcel({
        url: urlOrPath,
        sheet: options.sheet,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        importId,
      } satisfies ImportMyMfnOptions);
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesMyFtaOfficial: Command = async (args) => {
  const options = parseFtaOptions(args);
  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_MY_FTA_SOURCE_KEY,
    fallbackUrl: options.urlOrPath || undefined,
  });

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:my-fta-official',
      sourceKey: DUTIES_MY_FTA_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet: options.sheet,
        agreement: options.agreement,
        partner: options.partner,
        batchSize: options.batchSize,
        dryRun: options.dryRun ? '1' : undefined,
        sourceKey: DUTIES_MY_FTA_SOURCE_KEY,
      },
    },
    async (importId) => {
      const res = await importMyPreferentialFromExcel({
        url: urlOrPath,
        sheet: options.sheet,
        agreement: options.agreement,
        partner: options.partner,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        importId,
      } satisfies ImportMyPreferentialParams);
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesMyAllOfficial: Command = async (args) => {
  await dutiesMyMfnOfficial(args);
  await dutiesMyFtaOfficial(args);
};
