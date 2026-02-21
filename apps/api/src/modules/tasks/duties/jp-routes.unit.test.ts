import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importJpMfn: vi.fn(),
  importJpPreferentialOfficial: vi.fn(),
  importJpPreferentialWits: vi.fn(),
}));

vi.mock('../../duty-rates/services/jp/import-mfn.js', () => ({
  importJpMfn: mocks.importJpMfn,
}));

vi.mock('../../duty-rates/services/jp/import-preferential.js', () => ({
  importJpPreferential: mocks.importJpPreferentialOfficial,
  importJpPreferentialFromWits: mocks.importJpPreferentialWits,
}));

import jpDutyRoutes from './jp-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  jpDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importJpMfn.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importJpPreferentialOfficial.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importJpPreferentialWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
});

describe('jp duties WITS explicit FTA routes', () => {
  it('uses official importer on /jp-fta', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/jp-fta',
      payload: { partnerGeoIds: ['US'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importJpPreferentialOfficial).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerGeoIds: ['US'],
        dryRun: true,
        useWitsFallback: true,
      })
    );
    expect(mocks.importJpPreferentialWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses WITS importer on /jp-fta/wits', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/jp-fta/wits',
      payload: { partnerGeoIds: ['US'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importJpPreferentialWits).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerGeoIds: ['US'],
        dryRun: true,
      })
    );
    expect(mocks.importJpPreferentialOfficial).not.toHaveBeenCalled();
    await app.close();
  });
});
