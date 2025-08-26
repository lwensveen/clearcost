//
// Admin-only cron/import routes:
// - FX refresh (ECB primary; optional secondary fill)
// - VAT (auto from OECD/IMF) + manual JSON import
// - Duty rates: WITS (MFN + FTA), UK (MFN/FTA, streaming), EU (MFN/FTA), US (MFN/FTA)
// - Surcharges + Freight cards (JSON)
//
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod/v4';
import { refreshFx } from '../../lib/refresh-fx.js';
import { importVatRules } from '../vat/services/import-vat.js';
import { fetchVatRowsFromOfficialSources } from '../vat/services/fetch-vat-official.js';
import { importDutyRates } from '../duty-rates/services/import-duty-rates.js';
import { importDutyRatesFromWITS } from '../duty-rates/services/wits/import-from-wits.js';
import { batchUpsertDutyRatesFromStream } from '../duty-rates/utils/batch-upsert.js';
import { streamUkMfnDutyRates } from '../duty-rates/services/uk/mfn.js';
import { streamUkPreferentialDutyRates } from '../duty-rates/services/uk/preferential.js';
import { fetchEuMfnDutyRates } from '../duty-rates/services/eu/mfn.js';
import { fetchEuPreferentialDutyRates } from '../duty-rates/services/eu/preferential.js';
import { importUsMfn } from '../duty-rates/services/us/import-from-hts.js';
import { importUsPreferential } from '../duty-rates/services/us/import-preferential.js';
import { importSurcharges } from '../surcharges/services/import-surcharges.js';
import { importFreightCards } from '../freight/services/import-cards.js';
import { DutyRateInsert, SurchargeInsert } from '@clearcost/types';
import { importUsTradeRemediesFromHTS } from '../surcharges/services/us/import-usitc-hts.js';
import { importAllUsSurcharges } from '../surcharges/services/us/import-all.js';

type FreightStep = { uptoQty: number; pricePerUnit: number };
type FreightCardRow = {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  minCharge?: number;
  priceRounding?: number;
  volumetricDivisor?: number;
  notes?: string | null;
  steps: FreightStep[];
};

const ADMIN_HEADER_SCHEMA = z.object({
  authorization: z.string().optional(),
  'x-admin-token': z.string().optional(),
});

function isAuthorizedAdmin(headers: unknown): boolean {
  const parsed = ADMIN_HEADER_SCHEMA.parse(headers ?? {});
  const expected = process.env.ADMIN_TOKEN ?? '';
  const presented =
    parsed['x-admin-token'] || parsed.authorization?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(expected && presented === expected);
}

const adminGuard: preHandlerHookHandler = (req, reply, done) => {
  if (!isAuthorizedAdmin(req.headers)) {
    reply.unauthorized('Admin token required');
    return;
  }
  done();
};

const USER_AGENT = 'clearcost-importer';

async function fetchJSON<T>(path: string): Promise<T> {
  const base = (process.env.DATA_REMOTE_BASE ?? '').replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${base}/${path.replace(/^\/+/, '')}`;

  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${body}`);
  }
  return res.json() as Promise<T>;
}

export default function registerTasksRoutes(app: FastifyInstance) {
  // FX: refresh daily (ECB primary + optional secondary fill)
  app.post('/internal/cron/fx/daily', { preHandler: adminGuard }, async (_req, reply) => {
    const inserted = await refreshFx();
    return reply.send({ ok: true, inserted });
  });

  // VAT: official sources (OECD/IMF)
  app.post('/internal/cron/import/vat/auto', { preHandler: adminGuard }, async (_req, reply) => {
    const rows = await fetchVatRowsFromOfficialSources();
    const result = await importVatRules(rows);
    return reply.send(result);
  });

  // Duty rates: JSON file (manual)
  app.post('/internal/cron/import/duties', { preHandler: adminGuard }, async (_req, reply) => {
    const rows = await fetchJSON<DutyRateInsert[]>('duties/duty-rates.json');

    const mapped: DutyRateInsert[] = rows
      .map((r) => {
        return {
          dest: r.dest.toUpperCase(),
          hs6: String(r.hs6).slice(0, 6),
          ratePct: r.ratePct,
          rule: r.rule,
          currency: r.currency,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes ?? null,
        } as DutyRateInsert;
      })
      .filter((x) => x !== null);

    const result = await importDutyRates(mapped);
    return reply.send(result);
  });

  // Duty rates: WITS (MFN + Preferential), bounded concurrency + batched upsert internally
  app.post('/internal/cron/import/duties/wits', { preHandler: adminGuard }, async (req, reply) => {
    const Body = z.object({
      dests: z.array(z.string().length(2)).min(1),
      partners: z.array(z.string().length(2)).optional(),
      year: z.coerce.number().int().min(1990).max(2100).optional(),
      backfillYears: z.coerce.number().int().min(0).max(5).optional(),
      concurrency: z.coerce.number().int().min(1).max(6).optional(),
      batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
    });
    const params = Body.parse(req.body ?? {});
    const result = await importDutyRatesFromWITS({
      dests: params.dests,
      partners: params.partners ?? [],
      year: params.year,
      backfillYears: params.backfillYears ?? 1,
      concurrency: params.concurrency ?? 3,
      batchSize: params.batchSize ?? 5000,
      hs6List: params.hs6List,
    });
    return reply.send(result);
  });

  // UK MFN (streaming)
  app.post(
    '/internal/cron/import/duties/uk-mfn',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      });
      const { hs6, batchSize } = Body.parse(req.body ?? {});
      const res = await batchUpsertDutyRatesFromStream(
        // pass the async generator directly
        streamUkMfnDutyRates({ hs6List: hs6 }),
        { batchSize }
      );
      return reply.send(res);
    }
  );

  // UK Preferential (streaming)
  app.post(
    '/internal/cron/import/duties/uk-fta',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        partners: z.array(z.string()).optional(), // numeric geo IDs, ISO2, or name fragments
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      });
      const { hs6, partners, batchSize } = Body.parse(req.body ?? {});
      const res = await batchUpsertDutyRatesFromStream(
        streamUkPreferentialDutyRates({ hs6List: hs6, partners }),
        { batchSize }
      );
      return reply.send(res);
    }
  );

  // EU MFN (TARIC with WITS fallback)
  app.post(
    '/internal/cron/import/duties/eu-mfn',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      });
      const { hs6, batchSize } = Body.parse(req.body ?? {});
      const rows = await fetchEuMfnDutyRates({ hs6List: hs6 });
      const res = await batchUpsertDutyRatesFromStream(rows, { batchSize });
      return reply.send(res);
    }
  );

  // EU Preferential (TARIC)
  app.post(
    '/internal/cron/import/duties/eu-fta',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({
        hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
        partnerGeoIds: z.array(z.string()).optional(), // e.g. ["JP","TR","1013"]
        batchSize: z.coerce.number().int().min(1).max(20000).optional(),
      });
      const { hs6, partnerGeoIds, batchSize } = Body.parse(req.body ?? {});
      const rows = await fetchEuPreferentialDutyRates({ hs6List: hs6, partnerGeoIds });
      const res = await batchUpsertDutyRatesFromStream(rows, { batchSize });
      return reply.send(res);
    }
  );

  // US MFN (Column 1 “General” from HTS)
  app.post(
    '/internal/cron/import/duties/us-mfn',
    { preHandler: adminGuard },
    async (_req, reply) => {
      const res = await importUsMfn();
      return reply.send(res);
    }
  );

  // US Preferential (Column 1 “Special” from HTS)
  app.post(
    '/internal/cron/import/duties/us-preferential',
    { preHandler: adminGuard },
    async (_req, reply) => {
      const res = await importUsPreferential();
      return reply.send(res);
    }
  );

  // Surcharges (JSON)
  app.post('/internal/cron/import/surcharges', { preHandler: adminGuard }, async (_req, reply) => {
    const rows = await fetchJSON<SurchargeInsert[]>('surcharges/surcharges.json');

    const mapped = rows
      .map((r) => {
        return {
          dest: r.dest.toUpperCase(),
          code: r.code,
          fixedAmt: r.fixedAmt,
          pctAmt: r.pctAmt,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes ?? undefined,
        };
      })
      .filter((x) => x !== null);

    const result = await importSurcharges(mapped);
    return reply.send(result);
  });

  // Freight cards (JSON)
  app.post('/internal/cron/import/freight', { preHandler: adminGuard }, async (_req, reply) => {
    const rows = await fetchJSON<FreightCardRow[]>('freight/freight-cards.json');
    const result = await importFreightCards(rows as unknown as any);
    return reply.send(result);
  });

  app.post(
    '/internal/cron/import/surcharges/us-trade-remedies',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({
        effectiveFrom: z.coerce.date().optional(),
        skipFree: z.coerce.boolean().optional(),
      });
      const { effectiveFrom, skipFree } = Body.parse(req.body ?? {});
      const res = await importUsTradeRemediesFromHTS({ effectiveFrom, skipFree });
      return reply.send(res);
    }
  );

  app.post(
    '/internal/cron/import/surcharges/us-all',
    { preHandler: adminGuard },
    async (req, reply) => {
      const Body = z.object({ batchSize: z.coerce.number().int().min(1).max(20000).optional() });
      const { batchSize } = Body.parse(req.body ?? {});
      const res = await importAllUsSurcharges({ batchSize });
      return reply.send(res);
    }
  );
}
