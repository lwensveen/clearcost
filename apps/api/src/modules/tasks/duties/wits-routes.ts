import { FastifyInstance } from 'fastify';
import { adminGuard } from '../common.js';
import { z } from 'zod/v4';
import { importDutyRatesFromWITS } from '../../duty-rates/services/wits/import-from-wits.js';

export default function witsDutyRoutes(app: FastifyInstance) {
  // WITS (MFN + Preferential): generic
  app.post(
    '/internal/cron/import/duties/wits',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'WITS', job: 'duties:wits' } },
    },
    async (req, reply) => {
      const Body = z.object({
        dests: z.array(z.string().length(2)).min(1),
        partners: z.array(z.string().length(2)).optional(),
        year: z.coerce.number().int().min(1990).max(2100).optional(),
        backfillYears: z.coerce.number().int().min(0).max(5).optional(),
        concurrency: z.coerce.number().int().min(1).max(6).optional(),
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
        hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
      });
      const p = Body.parse(req.body ?? {});
      const importId = (req as any).importRunId as string | undefined;

      const res = await importDutyRatesFromWITS({
        dests: p.dests,
        partners: p.partners ?? [],
        year: p.year,
        backfillYears: p.backfillYears ?? 1,
        concurrency: p.concurrency ?? 3,
        batchSize: p.batchSize ?? 5000,
        hs6List: p.hs6List,
        importId,
      });

      return reply.send(res);
    }
  );

  // WITS: ASEAN preset
  app.post(
    '/internal/cron/import/duties/wits/asean',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'WITS', job: 'duties:wits:asean' } },
    },
    async (req, reply) => {
      const Body = z.object({
        year: z.coerce.number().int().min(1990).max(2100).optional(),
        backfillYears: z.coerce.number().int().min(0).max(5).default(1),
        concurrency: z.coerce.number().int().min(1).max(6).default(4),
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        dests: z.array(z.string().length(2)).optional(),
        partners: z.array(z.string().length(2)).optional(),
      });
      const b = Body.parse(req.body ?? {});
      const defaultDests = ['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM'];
      const dests = (b.dests ?? defaultDests).map((s) => s.toUpperCase());
      const partners = (b.partners ?? defaultDests).map((s) => s.toUpperCase());
      const importId = (req as any).importRunId as string | undefined;

      const res = await importDutyRatesFromWITS({
        dests,
        partners,
        year: b.year,
        backfillYears: b.backfillYears,
        concurrency: b.concurrency,
        batchSize: 5000,
        hs6List: b.hs6,
        importId,
      });

      return reply.send(res);
    }
  );

  // WITS: Japan preset
  app.post(
    '/internal/cron/import/duties/wits/japan',
    {
      preHandler: adminGuard,
      config: { importMeta: { source: 'WITS', job: 'duties:wits:japan' } },
    },
    async (req, reply) => {
      const Body = z.object({
        year: z.coerce.number().int().min(1990).max(2100).optional(),
        backfillYears: z.coerce.number().int().min(0).max(5).default(1),
        concurrency: z.coerce.number().int().min(1).max(6).default(3),
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        partners: z.array(z.string().length(2)).optional(),
      });
      const b = Body.parse(req.body ?? {});
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
      const importId = (req as any).importRunId as string | undefined;

      const res = await importDutyRatesFromWITS({
        dests: ['JP'],
        partners,
        year: b.year,
        backfillYears: b.backfillYears,
        concurrency: b.concurrency,
        batchSize: 5000,
        hs6List: b.hs6,
        importId,
      });

      return reply.send(res);
    }
  );
}
