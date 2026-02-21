import { FastifyInstance } from 'fastify';
import { importCnMfn } from '../../duty-rates/services/cn/import-mfn.js';
import { importCnPreferential } from '../../duty-rates/services/cn/import-preferential.js';
import { importCnMfnFromPdf } from '../../duty-rates/services/cn/import-mfn-pdf.js';
import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';
import {
  TasksDutyCnMfnPdfBodySchema,
  TasksDutyMyOfficialPdfBodySchema,
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
} from '@clearcost/types';

export default function cnDutyRoutes(app: FastifyInstance) {
  // CN MFN (official PDF default)
  {
    const Body = TasksDutyMyOfficialPdfBodySchema;

    app.post(
      '/cron/import/duties/cn-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'CN_TAXBOOK',
            job: 'duties:cn-mfn-official',
            sourceKey: 'duties.cn.taxbook.pdf',
          },
        },
      },
      async (req, reply) => {
        const { url, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveSourceDownloadUrl({
          sourceKey: 'duties.cn.taxbook.pdf',
          fallbackUrl: url,
        });
        const res = await importCnMfnFromPdf({
          urlOrPath,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // CN MFN (WITS fallback)
  {
    const Body = TasksDutyHs6BatchDryRunBodySchema;

    app.post(
      '/cron/import/duties/cn-mfn/wits',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:cn-mfn-wits',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importCnMfn({
          hs6List: hs6,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // CN Preferential (WITS default; no official source yet)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/cn-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:cn-fta',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importCnPreferential({
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // CN Preferential (WITS explicit)
  {
    const Body = TasksDutyHs6BatchPartnerGeoIdsBodySchema;

    app.post(
      '/cron/import/duties/cn-fta/wits',
      {
        preHandler: app.requireApiKey(['tasks:duties:cn']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'WITS',
            job: 'duties:cn-fta-wits',
            sourceKey: 'duties.wits.sdmx.base',
          },
        },
      },
      async (req, reply) => {
        const { hs6, partnerGeoIds, batchSize, dryRun } = Body.parse(req.body ?? {});
        const res = await importCnPreferential({
          hs6List: hs6,
          partnerGeoIds,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send(res);
      }
    );
  }

  // CN MFN — official tariff book (PDF)
  const Body = TasksDutyCnMfnPdfBodySchema;

  app.post(
    '/cron/import/duties/cn-mfn/official/pdf',
    {
      preHandler: app.requireApiKey(['tasks:duties:cn']),
      schema: { body: Body },
      config: {
        importMeta: {
          importSource: 'CN_TAXBOOK',
          job: 'duties:cn-mfn-pdf',
          sourceKey: 'duties.cn.taxbook.pdf',
        },
      },
    },
    async (req, reply) => {
      const { url, batchSize, dryRun } = Body.parse(req.body ?? {});
      const res = await importCnMfnFromPdf({
        urlOrPath: url,
        batchSize,
        dryRun,
        importId: req.importCtx?.runId,
      });
      return reply.send(res);
    }
  );
}
