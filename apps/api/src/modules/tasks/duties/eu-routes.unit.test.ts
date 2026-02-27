import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importEuMfn: vi.fn(),
  importEuPreferential: vi.fn(),
  importEuFromDaily: vi.fn(),
}));

vi.mock('../../duty-rates/services/eu/import-mfn.js', () => ({
  importEuMfn: mocks.importEuMfn,
}));

vi.mock('../../duty-rates/services/eu/import-preferential.js', () => ({
  importEuPreferential: mocks.importEuPreferential,
}));

vi.mock('../../duty-rates/services/eu/import-daily.js', () => ({
  importEuFromDaily: mocks.importEuFromDaily,
}));

import euDutyRoutes from './eu-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  euDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importEuMfn.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importEuPreferential.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importEuFromDaily.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
});

describe('eu duties routes', () => {
  it('passes TARIC XML overrides on /eu-mfn', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/eu-mfn',
      payload: {
        hs6: ['850440'],
        xmlMeasureUrl: 'https://example.com/taric/measure.xml',
        xmlComponentUrl: 'https://example.com/taric/component.xml',
        xmlDutyExprUrl: 'https://example.com/taric/duty-expression.xml',
        language: 'EN',
        dryRun: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importEuMfn).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        dryRun: true,
        xml: {
          measureUrl: 'https://example.com/taric/measure.xml',
          componentUrl: 'https://example.com/taric/component.xml',
          dutyExprUrl: 'https://example.com/taric/duty-expression.xml',
          language: 'EN',
        },
      })
    );
    await app.close();
  });

  it('passes TARIC XML overrides on /eu-fta', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/eu-fta',
      payload: {
        partnerGeoIds: ['JP'],
        xmlMeasureUrl: 'https://example.com/taric/measure.xml',
        xmlComponentUrl: 'https://example.com/taric/component.xml',
        xmlGeoDescUrl: 'https://example.com/taric/geo-description.xml',
        xmlDutyExprUrl: 'https://example.com/taric/duty-expression.xml',
        language: 'EN',
        dryRun: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importEuPreferential).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerGeoIds: ['JP'],
        dryRun: true,
        xml: {
          measureUrl: 'https://example.com/taric/measure.xml',
          componentUrl: 'https://example.com/taric/component.xml',
          geoDescUrl: 'https://example.com/taric/geo-description.xml',
          dutyExprUrl: 'https://example.com/taric/duty-expression.xml',
          language: 'EN',
        },
      })
    );
    await app.close();
  });

  it('passes daily TARIC source override on /eu/daily', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/eu/daily',
      payload: {
        include: 'both',
        dailyListUrl:
          'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en',
        language: 'EN',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importEuFromDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        include: 'both',
        dailyListUrl:
          'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en',
        language: 'EN',
      })
    );
    await app.close();
  });
});
