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

const DUTIES_VN_MFN_SOURCE_KEY = 'duties.vn.official.mfn_excel';
const DUTIES_VN_FTA_SOURCE_KEY = 'duties.vn.official.fta_excel';

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
  const fallbackUrl = flagStr(flags, 'url') ?? process.env.VN_MFN_OFFICIAL_EXCEL_URL;
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
  const fallbackUrl = flagStr(flags, 'url') ?? process.env.VN_FTA_OFFICIAL_EXCEL_URL;
  return {
    urlOrPath: fallbackUrl ?? '',
    sheet: maybeSheet(flagStr(flags, 'sheet')),
    agreement: flagStr(flags, 'agreement'),
    partner: flagStr(flags, 'partner'),
    batchSize: flagNum(flags, 'batchSize'),
    dryRun: flagBool(flags, 'dryRun'),
  };
}

export const dutiesVnMfnOfficial: Command = async (args) => {
  const options = parseMfnOptions(args);
  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_VN_MFN_SOURCE_KEY,
    fallbackUrl: options.urlOrPath || undefined,
  });

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:vn-mfn-official',
      sourceKey: DUTIES_VN_MFN_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet: options.sheet,
        batchSize: options.batchSize,
        dryRun: options.dryRun ? '1' : undefined,
        sourceKey: DUTIES_VN_MFN_SOURCE_KEY,
      },
    },
    async (importId) => {
      const res = await importAseanMfnOfficialFromExcel({
        dest: 'VN',
        urlOrPath,
        sheet: options.sheet,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        importId,
      } satisfies ImportAseanMfnOfficialExcelOptions);
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesVnFtaOfficial: Command = async (args) => {
  const options = parseFtaOptions(args);
  const urlOrPath = await resolveAseanDutySourceUrl({
    sourceKey: DUTIES_VN_FTA_SOURCE_KEY,
    fallbackUrl: options.urlOrPath || undefined,
  });

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:vn-fta-official',
      sourceKey: DUTIES_VN_FTA_SOURCE_KEY,
      sourceUrl: urlOrPath,
      params: {
        url: urlOrPath,
        sheet: options.sheet,
        agreement: options.agreement,
        partner: options.partner,
        batchSize: options.batchSize,
        dryRun: options.dryRun ? '1' : undefined,
        sourceKey: DUTIES_VN_FTA_SOURCE_KEY,
      },
    },
    async (importId) => {
      const res = await importAseanPreferentialOfficialFromExcel({
        dest: 'VN',
        urlOrPath,
        sheet: options.sheet,
        agreement: options.agreement,
        partner: options.partner,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
        importId,
      } satisfies ImportAseanPreferentialOfficialExcelOptions);
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesVnAllOfficial: Command = async (args) => {
  await dutiesVnMfnOfficial(args);
  await dutiesVnFtaOfficial(args);
};
