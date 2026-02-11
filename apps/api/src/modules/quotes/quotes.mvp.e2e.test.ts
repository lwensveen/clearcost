import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  auditQuotesTable,
  db,
  dutyRatesTable,
  fxRatesTable,
  importsTable,
  quoteSnapshotsTable,
  vatRulesTable,
} from '@clearcost/db';
import { sql } from 'drizzle-orm';
import quoteRoutes from './routes.js';

const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');
const FX_AS_OF = new Date('2026-01-15T00:00:00.000Z');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

async function resetMvpQuoteTables() {
  await db.execute(sql`
    TRUNCATE TABLE
      quote_snapshots,
      audit_quotes,
      idempotency_keys,
      imports,
      duty_rates,
      vat_overrides,
      vat_rules,
      fx_rates
    RESTART IDENTITY CASCADE
  `);
}

async function seedMvpData() {
  await db.insert(fxRatesTable).values({
    base: 'USD',
    quote: 'EUR',
    rate: '0.92000000', // Demo FX: 1 USD -> 0.92 EUR.
    fxAsOf: FX_AS_OF,
    provider: 'ecb',
    sourceRef: 'quotes-mvp-e2e',
  });

  await db.insert(vatRulesTable).values([
    {
      dest: 'NL',
      vatRateKind: 'STANDARD',
      source: 'official',
      ratePct: '21.000', // 21% NL standard VAT for most goods (demo).
      vatBase: 'CIF_PLUS_DUTY',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'MVP E2E VAT NL',
    },
    {
      dest: 'DE',
      vatRateKind: 'STANDARD',
      source: 'official',
      ratePct: '19.000', // 19% DE standard VAT for most goods (demo).
      vatBase: 'CIF_PLUS_DUTY',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'MVP E2E VAT DE',
    },
  ]);

  await db.insert(dutyRatesTable).values([
    {
      dest: 'NL',
      partner: 'US',
      hs6: '850440',
      source: 'official',
      ratePct: '3.700', // 3.7% demo MFN duty for HS6 850440 (US -> NL).
      dutyRule: 'mfn',
      currency: 'EUR',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'MVP E2E duty US->NL',
    },
    {
      dest: 'DE',
      partner: 'NL',
      hs6: '851830',
      source: 'official',
      ratePct: '0.000', // Intra-EU demo lane: duty is zero.
      dutyRule: 'mfn',
      currency: 'EUR',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'MVP E2E duty NL->DE',
    },
  ]);

  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - 20_000);
  await db.insert(importsTable).values([
    {
      importSource: 'ECB',
      job: 'fx:daily',
      version: 'mvp-e2e-v1',
      sourceUrl: 'test://fx',
      params: '{}',
      importStatus: 'succeeded',
      inserted: 1,
      updated: 0,
      startedAt,
      finishedAt,
    },
    {
      importSource: 'OECD/IMF',
      job: 'vat:auto',
      version: 'mvp-e2e-v1',
      sourceUrl: 'test://vat',
      params: '{}',
      importStatus: 'succeeded',
      inserted: 2,
      updated: 0,
      startedAt,
      finishedAt,
    },
    {
      importSource: 'TARIC',
      job: 'duties:eu-mfn',
      version: 'mvp-e2e-v1',
      sourceUrl: 'test://duties',
      params: '{}',
      importStatus: 'succeeded',
      inserted: 2,
      updated: 0,
      startedAt,
      finishedAt,
    },
  ]);
}

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_mvp_e2e', ownerId: 'owner_mvp_e2e' };
  });
  await app.register(quoteRoutes, { prefix: '/v1/quotes' });
  return app;
}

describeIfDb('quotes MVP e2e', () => {
  beforeAll(() => {
    if (!hasDatabase) {
      // eslint-disable-next-line no-console
      console.warn('Skipping MVP quote E2E test: DATABASE_URL is not configured.');
    }
  });

  beforeEach(async () => {
    await resetMvpQuoteTables();
    await seedMvpData();
  });

  it('POST /v1/quotes returns golden US->NL values for HS6 850440', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      headers: { 'idempotency-key': 'idem_mvp_e2e_happy' },
      payload: {
        origin: 'US',
        dest: 'NL',
        itemValue: { amount: 100, currency: 'USD' },
        dimsCm: { l: 20, w: 15, h: 10 },
        weightKg: 1.2,
        categoryKey: 'electronics_accessories',
        hs6: '850440',
        mode: 'air',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, any>;
    expect(body.dutyAmount).toBe(3.4);
    expect(body.vatAmount).toBe(20.03);
    expect(body.totalLandedCost).toBe(115.43);
    expect(body.total).toBe(115.43);

    await app.close();
  });

  it('POST /v1/quotes rejects above-de-minimis requests', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      headers: { 'idempotency-key': 'idem_mvp_e2e_above' },
      payload: {
        origin: 'US',
        dest: 'NL',
        itemValue: { amount: 200, currency: 'USD' },
        dimsCm: { l: 20, w: 15, h: 10 },
        weightKg: 1.2,
        categoryKey: 'electronics_accessories',
        hs6: '850440',
        mode: 'air',
      },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe('above_de_minimis');

    await app.close();
  });
});
