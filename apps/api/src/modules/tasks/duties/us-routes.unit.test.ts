import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importUsMfn: vi.fn(),
  importUsPreferential: vi.fn(),
}));

vi.mock('../../duty-rates/services/us/import-mfn.js', () => ({
  importUsMfn: mocks.importUsMfn,
}));

vi.mock('../../duty-rates/services/us/import-preferential.js', () => ({
  importUsPreferential: mocks.importUsPreferential,
}));

import usDutyRoutes from './us-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  usDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importUsMfn.mockResolvedValue({
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importUsPreferential.mockResolvedValue({
    inserted: 1,
    updated: 0,
    count: 1,
  });
});

describe('us duties routes', () => {
  it('passes source overrides on /us-mfn', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/us-mfn',
      payload: {
        baseUrl: 'https://example.com/usitc',
        csvUrl: 'https://example.com/usitc/hts.csv',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importUsMfn).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://example.com/usitc',
        csvUrl: 'https://example.com/usitc/hts.csv',
      })
    );
    await app.close();
  });

  it('passes source overrides on /us-preferential', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/us-preferential',
      payload: {
        baseUrl: 'https://example.com/usitc',
        csvUrl: 'https://example.com/usitc/hts.csv',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importUsPreferential).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://example.com/usitc',
        csvUrl: 'https://example.com/usitc/hts.csv',
      })
    );
    await app.close();
  });
});
