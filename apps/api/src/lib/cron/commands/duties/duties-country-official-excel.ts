import {
  importAseanMfnOfficialFromExcel,
  type ImportAseanMfnOfficialExcelOptions,
} from '../../../../modules/duty-rates/services/asean/shared/import-mfn-official-excel.js';
import {
  importAseanPreferentialOfficialFromExcel,
  type ImportAseanPreferentialOfficialExcelOptions,
} from '../../../../modules/duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';
import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { flagBool, flagNum, flagStr, parseFlags } from '../../utils.js';

type DutyCountryOfficialExcelConfig = {
  slug: string;
  dest: string;
  mfnSourceKey: string;
  ftaSourceKey: string;
  mfnEnvVar: string;
  ftaEnvVar: string;
};

type DutyCountryOfficialCommands = {
  mfn: Command;
  fta: Command;
  all: Command;
};

function maybeSheet(value: string | undefined): string | number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

function normalizeFallbackUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

async function resolveCountryDutySourceUrl(options: {
  sourceKey: string;
  cliUrl?: string;
  envVarName: string;
}): Promise<string> {
  const fallbackUrl =
    normalizeFallbackUrl(options.cliUrl) ?? normalizeFallbackUrl(process.env[options.envVarName]);
  if (fallbackUrl) {
    return resolveSourceDownloadUrl({ sourceKey: options.sourceKey, fallbackUrl });
  }
  return resolveSourceDownloadUrl({ sourceKey: options.sourceKey });
}

function createCountryMfnCommand(config: DutyCountryOfficialExcelConfig): Command {
  return async (args) => {
    const flags = parseFlags(args);
    const countryMfnSourceKey = config.mfnSourceKey;
    const sourceUrl = await resolveCountryDutySourceUrl({
      sourceKey: countryMfnSourceKey,
      cliUrl: flagStr(flags, 'url'),
      envVarName: config.mfnEnvVar,
    });
    const sheet = maybeSheet(flagStr(flags, 'sheet'));
    const batchSize = flagNum(flags, 'batchSize');
    const dryRun = flagBool(flags, 'dryRun');

    const payload = await withRun(
      {
        importSource: 'OFFICIAL',
        job: `duties:${config.slug}-mfn-official`,
        sourceKey: countryMfnSourceKey,
        sourceUrl,
        params: {
          country: config.dest,
          url: sourceUrl,
          sheet,
          batchSize,
          dryRun: dryRun ? '1' : undefined,
          sourceKey: countryMfnSourceKey,
        },
      },
      async (importId) => {
        const result = await importAseanMfnOfficialFromExcel({
          dest: config.dest,
          urlOrPath: sourceUrl,
          sheet,
          batchSize,
          dryRun,
          mapFreeToZero: true,
          skipSpecific: true,
          importId,
        } satisfies ImportAseanMfnOfficialExcelOptions);
        return { inserted: result.inserted, payload: result };
      }
    );

    console.log(payload);
  };
}

function createCountryFtaCommand(config: DutyCountryOfficialExcelConfig): Command {
  return async (args) => {
    const flags = parseFlags(args);
    const countryFtaSourceKey = config.ftaSourceKey;
    const sourceUrl = await resolveCountryDutySourceUrl({
      sourceKey: countryFtaSourceKey,
      cliUrl: flagStr(flags, 'url'),
      envVarName: config.ftaEnvVar,
    });
    const sheet = maybeSheet(flagStr(flags, 'sheet'));
    const batchSize = flagNum(flags, 'batchSize');
    const dryRun = flagBool(flags, 'dryRun');
    const agreement = flagStr(flags, 'agreement');
    const partner = flagStr(flags, 'partner');

    const payload = await withRun(
      {
        importSource: 'OFFICIAL',
        job: `duties:${config.slug}-fta-official`,
        sourceKey: countryFtaSourceKey,
        sourceUrl,
        params: {
          country: config.dest,
          url: sourceUrl,
          sheet,
          agreement,
          partner,
          batchSize,
          dryRun: dryRun ? '1' : undefined,
          sourceKey: countryFtaSourceKey,
        },
      },
      async (importId) => {
        const result = await importAseanPreferentialOfficialFromExcel({
          dest: config.dest,
          urlOrPath: sourceUrl,
          sheet,
          agreement,
          partner,
          batchSize,
          dryRun,
          importId,
        } satisfies ImportAseanPreferentialOfficialExcelOptions);
        return { inserted: result.inserted, payload: result };
      }
    );

    console.log(payload);
  };
}

export function createCountryOfficialDutyCommands(
  config: DutyCountryOfficialExcelConfig
): DutyCountryOfficialCommands {
  const mfn = createCountryMfnCommand(config);
  const fta = createCountryFtaCommand(config);

  return {
    mfn,
    fta,
    all: async (args) => {
      await mfn(args);
      await fta(args);
    },
  };
}
