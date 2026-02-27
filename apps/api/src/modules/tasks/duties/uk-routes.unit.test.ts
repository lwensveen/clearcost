import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  streamUkMfnDutyRates: vi.fn(),
  streamUkPreferentialDutyRates: vi.fn(),
  batchUpsertDutyRatesFromStream: vi.fn(),
}));

vi.mock('../../duty-rates/services/uk/mfn.js', () => ({
  streamUkMfnDutyRates: mocks.streamUkMfnDutyRates,
}));

vi.mock('../../duty-rates/services/uk/preferential.js', () => ({
  streamUkPreferentialDutyRates: mocks.streamUkPreferentialDutyRates,
}));

vi.mock('../../duty-rates/utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStream,
}));

import ukDutyRoutes from './uk-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  ukDutyRoutes(app);
  return app;
}

async function* emptyDutyRows() {
  yield* [];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.streamUkMfnDutyRates.mockReturnValue(emptyDutyRows());
  mocks.streamUkPreferentialDutyRates.mockReturnValue(emptyDutyRows());
  mocks.batchUpsertDutyRatesFromStream.mockResolvedValue({
    inserted: 1,
    updated: 0,
    count: 1,
  });
});

describe('uk duties routes', () => {
  it('passes apiBaseUrl override on /uk-mfn', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/uk-mfn',
      payload: { hs6: ['850440'], apiBaseUrl: 'https://example.com/uk/api' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.streamUkMfnDutyRates).toHaveBeenCalledWith({
      hs6List: ['850440'],
      apiBaseUrl: 'https://example.com/uk/api',
    });
    expect(mocks.batchUpsertDutyRatesFromStream).toHaveBeenCalled();
    await app.close();
  });

  it('passes apiBaseUrl override on /uk-fta', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/uk-fta',
      payload: { partners: ['US'], apiBaseUrl: 'https://example.com/uk/api' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.streamUkPreferentialDutyRates).toHaveBeenCalledWith({
      hs6List: undefined,
      partners: ['US'],
      apiBaseUrl: 'https://example.com/uk/api',
    });
    expect(mocks.batchUpsertDutyRatesFromStream).toHaveBeenCalled();
    await app.close();
  });
});
