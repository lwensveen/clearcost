import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { importDutyRatesFromWITS } from '../../duty-rates/services/wits/import-from-wits.js';

// ----------------------------
// Shared schemas & defaults
// ----------------------------
const GenericBody = z.object({
  dests: z.array(z.string().length(2)).min(1),
  partners: z.array(z.string().length(2)).optional().default([]),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(3),
  batchSize: z.coerce.number().int().min(1).max(20_000).default(5000),
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
});
type GenericBodyT = z.infer<typeof GenericBody>;

const AseanBody = z.object({
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(4),
  hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
  dests: z.array(z.string().length(2)).optional(),
  partners: z.array(z.string().length(2)).optional(),
});
type AseanBodyT = z.infer<typeof AseanBody>;

const JapanBody = z.object({
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(3),
  hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
  partners: z.array(z.string().length(2)).optional(),
});
type JapanBodyT = z.infer<typeof JapanBody>;

export default function witsDutyRoutes(app: FastifyInstance) {
  // ----------------------------
  // WITS (MFN + Preferential): generic
  // ----------------------------
  app.post(
    '/internal/cron/import/duties/wits',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits']),
      schema: { body: GenericBody },
      config: { importMeta: { importSource: 'WITS', job: 'duties:wits' } },
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
    '/internal/cron/import/duties/wits/asean',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits:asean']),
      schema: { body: AseanBody },
      config: { importMeta: { importSource: 'WITS', job: 'duties:wits:asean' } },
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
    '/internal/cron/import/duties/wits/japan',
    {
      preHandler: app.requireApiKey(['tasks:duties:wits:japan']),
      schema: { body: JapanBody },
      config: { importMeta: { importSource: 'WITS', job: 'duties:wits:japan' } },
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
