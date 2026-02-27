import { FastifyInstance } from 'fastify';
import { importAseanMfnOfficialFromExcel } from '../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveAseanDutySourceUrl } from '../../duty-rates/services/asean/source-urls.js';
import { DUTY_COUNTRY_SCAFFOLD_SLUGS } from '../../../lib/cron/commands/duties/duties-country-scaffold-data.js';
import {
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

type CountryScaffoldConfig = {
  slug: string;
  dest: string;
};

const COUNTRY_SCAFFOLD: ReadonlyArray<CountryScaffoldConfig> = DUTY_COUNTRY_SCAFFOLD_SLUGS.map(
  (slug) => ({ slug, dest: slug.toUpperCase() })
);

function mfnSourceKey(slug: string): string {
  return `duties.${slug}.official.mfn_excel`;
}

function ftaSourceKey(slug: string): string {
  return `duties.${slug}.official.fta_excel`;
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function scaffoldEnvVarName(slug: string, kind: 'mfn' | 'fta'): string {
  return `${slug.toUpperCase()}_${kind.toUpperCase()}_OFFICIAL_EXCEL_URL`;
}

function resolveScaffoldFallbackUrl(
  slug: string,
  kind: 'mfn' | 'fta',
  requestedUrl: string | undefined
): string | undefined {
  const explicitUrl = normalizeOptionalUrl(requestedUrl);
  if (explicitUrl) return explicitUrl;
  return normalizeOptionalUrl(process.env[scaffoldEnvVarName(slug, kind)]);
}

export default function countryScaffoldDutyRoutes(app: FastifyInstance) {
  for (const country of COUNTRY_SCAFFOLD) {
    const common = {
      preHandler: app.requireApiKey([`tasks:duties:${country.slug}`]),
    };

    const mfnKey = mfnSourceKey(country.slug);
    const ftaKey = ftaSourceKey(country.slug);
    const mfnJob = `duties:${country.slug}-mfn-official`;
    const ftaJob = `duties:${country.slug}-fta-official`;
    const mfnPath = `/cron/import/duties/${country.slug}-mfn`;
    const mfnOfficialPath = `/cron/import/duties/${country.slug}-mfn/official/excel`;
    const ftaPath = `/cron/import/duties/${country.slug}-fta`;
    const ftaOfficialPath = `/cron/import/duties/${country.slug}-fta/official/excel`;

    const runMfnOfficial = async (body: unknown, importId: string | undefined) => {
      const { url, sheet, batchSize, dryRun } = TasksDutyMyOfficialExcelBodySchema.parse(
        body ?? {}
      );
      const fallbackUrl = resolveScaffoldFallbackUrl(country.slug, 'mfn', url);
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: mfnKey,
        fallbackUrl,
      });

      return importAseanMfnOfficialFromExcel({
        dest: country.dest,
        urlOrPath,
        sheet,
        batchSize,
        dryRun,
        mapFreeToZero: true,
        skipSpecific: true,
        importId,
      });
    };

    const runFtaOfficial = async (body: unknown, importId: string | undefined) => {
      const { url, agreement, partner, sheet, batchSize, dryRun } =
        TasksDutyMyFtaOfficialExcelBodySchema.parse(body ?? {});
      const fallbackUrl = resolveScaffoldFallbackUrl(country.slug, 'fta', url);
      const urlOrPath = await resolveAseanDutySourceUrl({
        sourceKey: ftaKey,
        fallbackUrl,
      });

      return importAseanPreferentialOfficialFromExcel({
        dest: country.dest,
        urlOrPath,
        agreement,
        partner,
        sheet,
        batchSize,
        dryRun,
        importId,
      });
    };

    app.post(
      mfnPath,
      {
        ...common,
        schema: { body: TasksDutyMyOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: mfnJob,
            sourceKey: mfnKey,
          },
        },
      },
      async (req, reply) => {
        const result = await runMfnOfficial(req.body, req.importCtx?.runId);
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    app.post(
      mfnOfficialPath,
      {
        ...common,
        schema: { body: TasksDutyMyOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: mfnJob,
            sourceKey: mfnKey,
          },
        },
      },
      async (req, reply) => {
        const result = await runMfnOfficial(req.body, req.importCtx?.runId);
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    app.post(
      ftaPath,
      {
        ...common,
        schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: ftaJob,
            sourceKey: ftaKey,
          },
        },
      },
      async (req, reply) => {
        const result = await runFtaOfficial(req.body, req.importCtx?.runId);
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    app.post(
      ftaOfficialPath,
      {
        ...common,
        schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: ftaJob,
            sourceKey: ftaKey,
          },
        },
      },
      async (req, reply) => {
        const result = await runFtaOfficial(req.body, req.importCtx?.runId);
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );
  }
}
