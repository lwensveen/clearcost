import { FastifyInstance } from 'fastify';
import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';
import { importAseanMfnOfficialFromExcel } from '../../duty-rates/services/asean/shared/import-mfn-official-excel.js';
import { importAseanPreferentialOfficialFromExcel } from '../../duty-rates/services/asean/shared/import-preferential-official-excel.js';
import {
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
} from '@clearcost/types';

export default function krDutyRoutes(app: FastifyInstance) {
  // KR MFN (official Excel default)
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/kr-mfn',
      {
        preHandler: app.requireApiKey(['tasks:duties:kr']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:kr-mfn-official',
            sourceKey: 'duties.kr.official.mfn_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveSourceDownloadUrl({
          sourceKey: 'duties.kr.official.mfn_excel',
          fallbackUrl: url,
        });
        const res = await importAseanMfnOfficialFromExcel({
          dest: 'KR',
          urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // KR MFN (official Excel explicit)
  {
    const Body = TasksDutyMyOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/kr-mfn/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:kr']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:kr-mfn-official',
            sourceKey: 'duties.kr.official.mfn_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveSourceDownloadUrl({
          sourceKey: 'duties.kr.official.mfn_excel',
          fallbackUrl: url,
        });
        const res = await importAseanMfnOfficialFromExcel({
          dest: 'KR',
          urlOrPath,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // KR FTA (official Excel default)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/kr-fta',
      {
        preHandler: app.requireApiKey(['tasks:duties:kr']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:kr-fta-official',
            sourceKey: 'duties.kr.official.fta_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveSourceDownloadUrl({
          sourceKey: 'duties.kr.official.fta_excel',
          fallbackUrl: url,
        });
        const res = await importAseanPreferentialOfficialFromExcel({
          dest: 'KR',
          urlOrPath,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }

  // KR FTA (official Excel explicit)
  {
    const Body = TasksDutyMyFtaOfficialExcelBodySchema;

    app.post(
      '/cron/import/duties/kr-fta/official/excel',
      {
        preHandler: app.requireApiKey(['tasks:duties:kr']),
        schema: { body: Body },
        config: {
          importMeta: {
            importSource: 'OFFICIAL',
            job: 'duties:kr-fta-official',
            sourceKey: 'duties.kr.official.fta_excel',
          },
        },
      },
      async (req, reply) => {
        const { url, agreement, partner, sheet, batchSize, dryRun } = Body.parse(req.body ?? {});
        const urlOrPath = await resolveSourceDownloadUrl({
          sourceKey: 'duties.kr.official.fta_excel',
          fallbackUrl: url,
        });
        const res = await importAseanPreferentialOfficialFromExcel({
          dest: 'KR',
          urlOrPath,
          agreement,
          partner,
          sheet,
          batchSize,
          dryRun,
          importId: req.importCtx?.runId,
        });
        return reply.send({ importId: req.importCtx?.runId, ...res });
      }
    );
  }
}
