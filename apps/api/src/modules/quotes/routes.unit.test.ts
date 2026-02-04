import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withIdempotencyMock: vi.fn(),
  quoteLandedCostMock: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      insert: mocks.insertMock,
      select: mocks.selectMock,
      query: {
        idempotencyKeysTable: {
          findFirst: mocks.findFirstMock,
        },
      },
    },
  };
});

vi.mock('../../lib/idempotency.js', () => ({
  withIdempotency: mocks.withIdempotencyMock,
}));

vi.mock('./services/quote-landed-cost.js', () => ({
  quoteLandedCost: mocks.quoteLandedCostMock,
}));

import quoteRoutes from './routes.js';

const sampleQuote = {
  hs6: '123456',
  currency: 'USD',
  incoterm: 'DAP' as const,
  chargeableKg: 2,
  freight: 20,
  deMinimis: {
    duty: null,
    vat: null,
    suppressDuty: false,
    suppressVAT: false,
  },
  components: {
    CIF: 120,
    duty: 6,
    vat: 25.2,
    fees: 7.4,
  },
  total: 158.6,
  guaranteedMax: 161.77,
  policy: 'Standard import tax rules apply.',
  componentConfidence: {
    duty: 'authoritative' as const,
    vat: 'authoritative' as const,
    surcharges: 'authoritative' as const,
    freight: 'authoritative' as const,
    fx: 'authoritative' as const,
  },
  overallConfidence: 'authoritative' as const,
  missingComponents: [] as Array<'duty' | 'vat' | 'surcharges' | 'freight' | 'fx'>,
  sources: {
    duty: { provider: null, dataset: null, asOf: null, effectiveFrom: null },
    vat: { provider: null, dataset: null, asOf: null, effectiveFrom: null },
    surcharges: { provider: null, dataset: null, asOf: null, effectiveFrom: null },
  },
};

const quoteInput = {
  origin: 'CN',
  dest: 'DE',
  itemValue: { amount: 100, currency: 'USD' },
  dimsCm: { l: 10, w: 10, h: 10 },
  weightKg: 2,
  categoryKey: 'apparel',
  hs6: '123456',
  mode: 'air',
};

function mockInsertSuccess() {
  const catchable = { catch: vi.fn() };
  const values = vi.fn(() => catchable);
  mocks.insertMock.mockReturnValue({ values });
}

function mockReplayRow(row: unknown) {
  mocks.selectMock.mockImplementationOnce(() => ({
    from: () => ({
      where: () => ({
        limit: async () => (row ? [row] : []),
      }),
    }),
  }));
}

function mockRecentRows(rows: unknown[]) {
  mocks.selectMock.mockImplementationOnce(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  }));
}

function mockStatsCounts(last24h: number, last7d: number) {
  mocks.selectMock
    .mockImplementationOnce(() => ({
      from: () => ({
        where: async () => [{ count: last24h }],
      }),
    }))
    .mockImplementationOnce(() => ({
      from: () => ({
        where: async () => [{ count: last7d }],
      }),
    }));
}

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async (req: any) => {
    req.apiKey = { id: 'api_1', ownerId: 'owner_1' };
  });
  await app.register(quoteRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertSuccess();

  mocks.quoteLandedCostMock.mockResolvedValue({
    quote: sampleQuote,
    fxAsOf: new Date('2025-01-01T00:00:00.000Z'),
  });

  mocks.withIdempotencyMock.mockImplementation(async (_scope, _key, _body, compute) => {
    return compute();
  });
});

describe('quotes routes', () => {
  it('POST / returns quote and idempotency header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_1' },
      payload: quoteInput,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['idempotency-key']).toBe('idem_1');
    expect(res.json()).toMatchObject(sampleQuote);
    await app.close();
  });

  it('POST / marks replay responses with Idempotent-Replayed header', async () => {
    mocks.withIdempotencyMock.mockImplementation(async (_scope, _key, _body, _compute, opts) => {
      return opts.onReplay(sampleQuote);
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_replay' },
      payload: quoteInput,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['idempotent-replayed']).toBe('true');
    await app.close();
  });

  it('POST / returns 409 on idempotency conflicts', async () => {
    mocks.withIdempotencyMock.mockRejectedValue({ statusCode: 409, message: 'in progress' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_conflict' },
      payload: quoteInput,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { message: 'in progress' } });
    await app.close();
  });

  it('POST / returns 500 on unexpected quote failures', async () => {
    mocks.withIdempotencyMock.mockRejectedValue(new Error('boom'));

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'idem_fail' },
      payload: quoteInput,
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: { message: 'boom' } });
    await app.close();
  });

  it('GET /by-key/:key returns 404 when cached quote is missing', async () => {
    mocks.findFirstMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/by-key/k_missing' });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('GET /by-key/:key returns replayed quote when cache hit is valid', async () => {
    mocks.findFirstMock.mockResolvedValueOnce({
      response: sampleQuote,
      status: 'completed',
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/by-key/k_ok' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['idempotent-replayed']).toBe('true');
    expect(res.headers['idempotency-key']).toBe('k_ok');
    await app.close();
  });

  it('GET /by-key/:key returns 409 for schema-incompatible cached payloads', async () => {
    mocks.findFirstMock.mockResolvedValueOnce({
      response: { broken: true },
      status: 'completed',
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/by-key/k_bad' });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('GET /replay returns 404 when idempotency row is not found', async () => {
    mockReplayRow(null);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/replay?key=nope' });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('GET /replay returns 409 when quote is not completed yet', async () => {
    mockReplayRow({
      status: 'processing',
      requestHash: 'h1',
      response: null,
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/replay?key=processing' });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('GET /replay returns 409 when cached response fails schema validation', async () => {
    mockReplayRow({
      status: 'completed',
      requestHash: 'h2',
      response: { bad: true },
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/replay?key=invalid' });

    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('GET /replay returns cached quote for completed valid rows', async () => {
    mockReplayRow({
      status: 'completed',
      requestHash: 'h3',
      response: sampleQuote,
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/replay?key=ok' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['idempotent-replayed']).toBe('true');
    await app.close();
  });

  it('GET /recent maps valid and invalid snapshot rows safely', async () => {
    mockRecentRows([
      {
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        idemKey: 'a',
        request: quoteInput,
        response: sampleQuote,
      },
      {
        createdAt: null,
        idemKey: 'b',
        request: { nope: true },
        response: { nope: true },
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/recent?limit=10' });
    const json = res.json() as { rows: Array<Record<string, unknown>> };

    expect(res.statusCode).toBe(200);
    expect(json.rows).toHaveLength(2);
    expect(json.rows[0]).toMatchObject({ idemKey: 'a', total: 158.6, duty: 6, fees: 7.4 });
    expect(json.rows[1]).toMatchObject({ idemKey: 'b', total: 0, duty: 0, fees: 0 });
    await app.close();
  });

  it('GET /stats returns 24h and 7d counts', async () => {
    mockStatsCounts(3, 10);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/stats' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      last24h: { count: 3 },
      last7d: { count: 10 },
    });
    await app.close();
  });
});
