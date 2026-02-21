import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrl: vi.fn(),
  importCnMfnFromPdf: vi.fn(),
  importCnMfnFromWits: vi.fn(),
}));

vi.mock('../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrl,
}));

vi.mock('../../duty-rates/services/cn/import-mfn-pdf.js', () => ({
  importCnMfnFromPdf: mocks.importCnMfnFromPdf,
}));

vi.mock('../../duty-rates/services/cn/import-mfn.js', () => ({
  importCnMfn: mocks.importCnMfnFromWits,
}));

import cnDutyRoutes from './cn-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  cnDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveSourceDownloadUrl.mockResolvedValue('https://example.com/cn-tariff.pdf');
  mocks.importCnMfnFromPdf.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importCnMfnFromWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
});

describe('cn duties official-first defaults', () => {
  it('uses official PDF importer on /cn-mfn', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/cn-mfn',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.cn.taxbook.pdf',
      fallbackUrl: undefined,
    });
    expect(mocks.importCnMfnFromPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        urlOrPath: 'https://example.com/cn-tariff.pdf',
      })
    );
    expect(mocks.importCnMfnFromWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses WITS fallback on /cn-mfn/wits', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/cn-mfn/wits',
      payload: { hs6: ['850440'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importCnMfnFromWits).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        dryRun: true,
      })
    );
    expect(mocks.importCnMfnFromPdf).not.toHaveBeenCalled();
    await app.close();
  });
});
