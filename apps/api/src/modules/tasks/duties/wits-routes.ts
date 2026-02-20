import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importDutyRatesFromWITS } from '../../duty-rates/services/wits/import-from-wits.js';
import {
  TasksDutyWitsAseanBodySchema,
  TasksDutyWitsGenericBodySchema,
  TasksDutyWitsJapanBodySchema,
} from '@clearcost/types';

// ----------------------------
// Shared schemas & defaults
// ----------------------------
const GenericBody = TasksDutyWitsGenericBodySchema;
type GenericBodyT = z.infer<typeof TasksDutyWitsGenericBodySchema>;

const AseanBody = TasksDutyWitsAseanBodySchema;
type AseanBodyT = z.infer<typeof TasksDutyWitsAseanBodySchema>;

const JapanBody = TasksDutyWitsJapanBodySchema;
type JapanBodyT = z.infer<typeof TasksDutyWitsJapanBodySchema>;

export default function witsDutyRoutes(app: FastifyInstance) {
  // ----------------------------
  // WITS (MFN + Preferential): generic
  // ----------------------------
  app.post(
    '/cron/import/duties/wits',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits']),
      schema: { body: GenericBody },
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:wits',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
    async (req, reply) => {
      const p: GenericBodyT = GenericBody.parse(req.body ?? {});

      const res = await importDutyRatesFromWITS({
        dests: p.dests.map((s) => s.toUpperCase()),
        partners: (p.partners ?? []).map((s) => s.toUpperCase()),
        year: p.year,
        backfillYears: p.backfillYears,
        concurrency: p.concurrency,
        batchSize: p.batchSize,
        hs6List: p.hs6List,
        importId: req.importCtx?.runId,
      });

      return reply.send(res);
    }
  );

  // ----------------------------
  // WITS: ASEAN preset
  // ----------------------------
  app.post(
    '/cron/import/duties/wits/asean',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits:asean']),
      schema: { body: AseanBody },
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:wits:asean',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
    async (req, reply) => {
      const b: AseanBodyT = AseanBody.parse(req.body ?? {});
      const defaultDests = ['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM'];
      const dests = (b.dests ?? defaultDests).map((s) => s.toUpperCase());
      const partners = (b.partners ?? defaultDests).map((s) => s.toUpperCase());

      const res = await importDutyRatesFromWITS({
        dests,
        partners,
        year: b.year,
        backfillYears: b.backfillYears,
        concurrency: b.concurrency,
        batchSize: 5000,
        hs6List: b.hs6,
        importId: req.importCtx?.runId,
      });

      return reply.send(res);
    }
  );

  // ----------------------------
  // WITS: Japan preset
  // ----------------------------
  app.post(
    '/cron/import/duties/wits/japan',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits:japan']),
      schema: { body: JapanBody },
      config: {
        importMeta: {
          importSource: 'WITS',
          job: 'duties:wits:japan',
          sourceKey: 'duties.wits.sdmx.base',
        },
      },
    },
    async (req, reply) => {
      const b: JapanBodyT = JapanBody.parse(req.body ?? {});
      const defaultPartners = [
        'CN',
        'KR',
        'AU',
        'NZ',
        'TH',
        'MY',
        'ID',
        'PH',
        'VN',
        'LA',
        'KH',
        'BN',
        'SG',
        'CA',
        'MX',
        'EU',
        'GB',
        'US',
      ];
      const partners = (b.partners ?? defaultPartners).map((s) => s.toUpperCase());

      const res = await importDutyRatesFromWITS({
        dests: ['JP'],
        partners,
        year: b.year,
        backfillYears: b.backfillYears,
        concurrency: b.concurrency,
        batchSize: 5000,
        hs6List: b.hs6,
        importId: req.importCtx?.runId,
      });

      return reply.send(res);
    }
  );
}
