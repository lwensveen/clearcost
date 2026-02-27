import { resolveAseanDutySourceUrl } from '../../../../modules/duty-rates/services/asean/source-urls.js';
import { importPhMfnExcel } from '../../../../modules/duty-rates/services/asean/ph/import-mfn-excel.js';
import { importIdMfn } from '../../../../modules/duty-rates/services/asean/id/import-mfn.js';
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
import { flagBool, flagCSV, flagNum, flagStr, parseFlags } from '../../utils.js';

type AseanCountry = {
  slug: 'bn' | 'kh' | 'la' | 'mm' | 'sg' | 'th' | 'id' | 'ph';
  dest: 'BN' | 'KH' | 'LA' | 'MM' | 'SG' | 'TH' | 'ID' | 'PH';
  mfnSourceKey: string;
  ftaSourceKey: string;
  mfnImportSource: 'OFFICIAL' | 'PH_TARIFF_COMMISSION';
};

type ImportTotals = {
  count: number;
  inserted: number;
  updated: number;
};

const ASEAN_COUNTRIES: ReadonlyArray<AseanCountry> = [
  {
    slug: 'bn',
    dest: 'BN',
    mfnSourceKey: 'duties.bn.official.mfn_excel',
    ftaSourceKey: 'duties.bn.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'kh',
    dest: 'KH',
    mfnSourceKey: 'duties.kh.official.mfn_excel',
    ftaSourceKey: 'duties.kh.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'la',
    dest: 'LA',
    mfnSourceKey: 'duties.la.official.mfn_excel',
    ftaSourceKey: 'duties.la.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'mm',
    dest: 'MM',
    mfnSourceKey: 'duties.mm.official.mfn_excel',
    ftaSourceKey: 'duties.mm.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'sg',
    dest: 'SG',
    mfnSourceKey: 'duties.sg.official.mfn_excel',
    ftaSourceKey: 'duties.sg.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'th',
    dest: 'TH',
    mfnSourceKey: 'duties.th.official.mfn_excel',
    ftaSourceKey: 'duties.th.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'id',
    dest: 'ID',
    mfnSourceKey: 'duties.id.btki.xlsx',
    ftaSourceKey: 'duties.id.official.fta_excel',
    mfnImportSource: 'OFFICIAL',
  },
  {
    slug: 'ph',
    dest: 'PH',
    mfnSourceKey: 'duties.ph.tariff_commission.xlsx',
    ftaSourceKey: 'duties.ph.official.fta_excel',
    mfnImportSource: 'PH_TARIFF_COMMISSION',
  },
] as const;

function maybeSheet(value: string | undefined): string | number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

function parseCountries(value: string[] | undefined): AseanCountry[] {
  if (!value || value.length === 0) return [...ASEAN_COUNTRIES];

  const requested = new Set(value.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const selected = ASEAN_COUNTRIES.filter((country) => requested.has(country.slug));

  if (selected.length === 0) {
    throw new Error(`No valid ASEAN country slugs supplied in --countries=${value.join(',')}`);
  }

  const missing = [...requested].filter(
    (slug) => !ASEAN_COUNTRIES.some((country) => country.slug === slug)
  );
  if (missing.length > 0) {
    throw new Error(
      `Unknown ASEAN country slugs: ${missing.join(', ')} (supported: ${ASEAN_COUNTRIES.map((country) => country.slug).join(', ')})`
    );
  }

  return selected;
}

function addTotals(
  target: ImportTotals,
  step: { count?: number; inserted?: number; updated?: number }
) {
  target.count += step.count ?? 0;
  target.inserted += step.inserted ?? 0;
  target.updated += step.updated ?? 0;
}

async function runAseanMfnOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const countries = parseCountries(flagCSV(flags, 'countries'));
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };

  for (const country of countries) {
    const fallbackUrl =
      country.slug === 'id'
        ? process.env.ID_BTKI_XLSX_URL
        : country.slug === 'ph'
          ? process.env.PH_TARIFF_EXCEL_URL
          : undefined;
    const urlOrPath = await resolveAseanDutySourceUrl({
      sourceKey: country.mfnSourceKey,
      fallbackUrl,
    });

    const step = await withRun(
      {
        importSource: country.mfnImportSource,
        job: `duties:${country.slug}-mfn-official`,
        sourceKey: `${country.mfnSourceKey}`,
        sourceUrl: urlOrPath,
        params: {
          country: country.dest,
          url: urlOrPath,
          sheet,
          batchSize,
          dryRun: dryRun ? '1' : undefined,
          sourceKey: `${country.mfnSourceKey}`,
        },
      },
      async (importId) => {
        let result:
          | Awaited<ReturnType<typeof importIdMfn>>
          | Awaited<ReturnType<typeof importPhMfnExcel>>
          | Awaited<ReturnType<typeof importAseanMfnOfficialFromExcel>>;

        if (country.slug === 'id') {
          result = await importIdMfn({
            urlOrPath,
            batchSize,
            dryRun,
            importId,
          });
        } else if (country.slug === 'ph') {
          result = await importPhMfnExcel({
            urlOrPath,
            sheet,
            mapFreeToZero: true,
            skipSpecific: true,
            batchSize: batchSize ?? 5_000,
            dryRun,
            importId,
          });
        } else {
          result = await importAseanMfnOfficialFromExcel({
            dest: country.dest,
            urlOrPath,
            sheet,
            batchSize,
            dryRun,
            importId,
          } satisfies ImportAseanMfnOfficialExcelOptions);
        }

        return { inserted: result.inserted, payload: result };
      }
    );

    console.log({ step: `${country.slug}-mfn-official`, ...step });
    addTotals(totals, step);
  }

  return totals;
}

async function runAseanFtaOfficial(args: string[]): Promise<ImportTotals> {
  const flags = parseFlags(args);
  const countries = parseCountries(flagCSV(flags, 'countries'));
  const batchSize = flagNum(flags, 'batchSize');
  const dryRun = flagBool(flags, 'dryRun');
  const sheet = maybeSheet(flagStr(flags, 'sheet'));
  const agreement = flagStr(flags, 'agreement');
  const partner = flagStr(flags, 'partner');
  const totals: ImportTotals = { count: 0, inserted: 0, updated: 0 };

  for (const country of countries) {
    const urlOrPath = await resolveAseanDutySourceUrl({
      sourceKey: country.ftaSourceKey,
    });

    const step = await withRun(
      {
        importSource: 'OFFICIAL',
        job: `duties:${country.slug}-fta-official`,
        sourceKey: `${country.ftaSourceKey}`,
        sourceUrl: urlOrPath,
        params: {
          country: country.dest,
          url: urlOrPath,
          sheet,
          agreement,
          partner,
          batchSize,
          dryRun: dryRun ? '1' : undefined,
          sourceKey: `${country.ftaSourceKey}`,
        },
      },
      async (importId) => {
        const result = await importAseanPreferentialOfficialFromExcel({
          dest: country.dest,
          urlOrPath,
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

    console.log({ step: `${country.slug}-fta-official`, ...step });
    addTotals(totals, step);
  }

  return totals;
}

export const dutiesAseanMfnOfficial: Command = async (args) => {
  const totals = await runAseanMfnOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesAseanFtaOfficial: Command = async (args) => {
  const totals = await runAseanFtaOfficial(args);
  console.log({ ok: true, ...totals });
};

export const dutiesAseanAllOfficial: Command = async (args) => {
  const mfn = await runAseanMfnOfficial(args);
  const fta = await runAseanFtaOfficial(args);
  console.log({
    ok: true,
    count: mfn.count + fta.count,
    inserted: mfn.inserted + fta.inserted,
    updated: mfn.updated + fta.updated,
  });
};
