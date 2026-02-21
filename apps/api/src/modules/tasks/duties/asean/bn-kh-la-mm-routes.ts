import { FastifyInstance } from 'fastify';
import { importAseanMfnOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import { resolveAseanDutySourceUrl } from '../../../duty-rates/services/asean/source-urls.js';
import { importMfnFromWits } from '../../../duty-rates/services/wits/import-mfn.js';
import { importPreferentialFromWits } from '../../../duty-rates/services/wits/import-preferential.js';
import {
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

type AseanCountryConfig = {
  dest: 'BN' | 'KH' | 'LA' | 'MM';
  slug: 'bn' | 'kh' | 'la' | 'mm';
};

const ASEAN_COUNTRIES: ReadonlyArray<AseanCountryConfig> = [
  { dest: 'BN', slug: 'bn' },
  { dest: 'KH', slug: 'kh' },
  { dest: 'LA', slug: 'la' },
  { dest: 'MM', slug: 'mm' },
] as const;

function mfnSourceKey(slug: AseanCountryConfig['slug']): string {
  return `duties.${slug}.official.mfn_excel`;
}

function ftaSourceKey(slug: AseanCountryConfig['slug']): string {
  return `duties.${slug}.official.fta_excel`;
}

export default function bnKhLaMmDutyRoutes(app: FastifyInstance) {
  for (const country of ASEAN_COUNTRIES) {
    const common = {
      preHandler: app.requireApiKey([`tasks:duties:${country.slug}`]),
    };
    const mfnKey = mfnSourceKey(country.slug);
    const ftaKey = ftaSourceKey(country.slug);

    // MFN (official Excel default)
    app.post(
      `/cron/import/duties/${country.slug}-mfn`,
      {
        ...common,
        schema: { body: TasksDutyMyOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: `duties:${country.slug}-mfn-official`,
            sourceKey: mfnKey,
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = TasksDutyMyOfficialExcelBodySchema.parse(
          req.body ?? {}
        );
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: mfnKey,
          fallbackUrl: url,
        });
        const result = await importAseanMfnOfficialFromExcel({
          dest: country.dest,
          urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    // MFN (WITS fallback)
    app.post(
      `/cron/import/duties/${country.slug}-mfn/wits`,
      {
        ...common,
        schema: { body: TasksDutyHs6BatchDryRunBodySchema },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: `duties:${country.slug}-mfn-wits`,
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = TasksDutyHs6BatchDryRunBodySchema.parse(req.body ?? {});
        const result = await importMfnFromWits({
          dest: country.dest,
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(result);
      }
    );

    app.post(
      `/cron/import/duties/${country.slug}-mfn/official/excel`,
      {
        ...common,
        schema: { body: TasksDutyMyOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: `duties:${country.slug}-mfn-official`,
            sourceKey: mfnKey,
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = TasksDutyMyOfficialExcelBodySchema.parse(
          req.body ?? {}
        );
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: mfnKey,
          fallbackUrl: url,
        });
        const result = await importAseanMfnOfficialFromExcel({
          dest: country.dest,
          urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    // Preferential (official Excel default)
    app.post(
      `/cron/import/duties/${country.slug}-fta`,
      {
        ...common,
        schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: `duties:${country.slug}-fta-official`,
            sourceKey: ftaKey,
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } =
          TasksDutyMyFtaOfficialExcelBodySchema.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: ftaKey,
          fallbackUrl: url,
        });
        const result = await importAseanPreferentialOfficialFromExcel({
          dest: country.dest,
          urlOrPath,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );

    // Preferential (WITS fallback)
    app.post(
      `/cron/import/duties/${country.slug}-fta/wits`,
      {
        ...common,
        schema: { body: TasksDutyHs6BatchPartnerGeoIdsBodySchema },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: `duties:${country.slug}-fta-wits`,
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } =
          TasksDutyHs6BatchPartnerGeoIdsBodySchema.parse(req.body ?? {});
        const result = await importPreferentialFromWits({
          dest: country.dest,
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(result);
      }
    );

    app.post(
      `/cron/import/duties/${country.slug}-fta/official/excel`,
      {
        ...common,
        schema: { body: TasksDutyMyFtaOfficialExcelBodySchema },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: `duties:${country.slug}-fta-official`,
            sourceKey: ftaKey,
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } =
          TasksDutyMyFtaOfficialExcelBodySchema.parse(req.body ?? {});
        const urlOrPath = await resolveAseanDutySourceUrl({
          sourceKey: ftaKey,
          fallbackUrl: url,
        });
        const result = await importAseanPreferentialOfficialFromExcel({
          dest: country.dest,
          urlOrPath,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...result });
      }
    );
  }
}
