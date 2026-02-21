import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceUrl: vi.fn(),
  importOfficialMfn: vi.fn(),
  importOfficialFta: vi.fn(),
  importWitsMfn: vi.fn(),
  importWitsFta: vi.fn(),
}));

vi.mock('../../../duty-rates/services/asean/source-urls.js', () => ({
  resolveAseanDutySourceUrl: mocks.resolveSourceUrl,
}));

vi.mock('../../../duty-rates/services/asean/shared/import-mfn-official-excel.js', () => ({
  importAseanMfnOfficialFromExcel: mocks.importOfficialMfn,
}));

vi.mock('../../../duty-rates/services/asean/shared/import-preferential-official-excel.js', () => ({
  importAseanPreferentialOfficialFromExcel: mocks.importOfficialFta,
}));

vi.mock('../../../duty-rates/services/wits/import-mfn.js', () => ({
  importMfnFromWits: mocks.importWitsMfn,
}));

vi.mock('../../../duty-rates/services/wits/import-preferential.js', () => ({
  importPreferentialFromWits: mocks.importWitsFta,
}));

import bnKhLaMmDutyRoutes from './bn-kh-la-mm-routes.js';

const COUNTRIES = [
  { dest: 'BN', slug: 'bn' },
  { dest: 'KH', slug: 'kh' },
  { dest: 'LA', slug: 'la' },
  { dest: 'MM', slug: 'mm' },
] as const;

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  bnKhLaMmDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveSourceUrl.mockResolvedValue('https://example.com/source.xlsx');
  mocks.importOfficialMfn.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
    dryRun: false,
    scanned: 1,
    kept: 1,
    skipped: 0,
  });
  mocks.importOfficialFta.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
    dryRun: false,
    scanned: 1,
    kept: 1,
    skipped: 0,
  });
  mocks.importWitsMfn.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importWitsFta.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
});

describe('asean bn/kh/la/mm official-first routes', () => {
  it.each(COUNTRIES)('uses official MFN importer on /$slug-mfn', async ({ dest, slug }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-mfn`,
      payload: { sheet: 'Tariff' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: `duties.${slug}.official.mfn_excel`,
      fallbackUrl: undefined,
    });
    expect(mocks.importOfficialMfn).toHaveBeenCalledWith(
      expect.objectContaining({
        dest,
        urlOrPath: 'https://example.com/source.xlsx',
        sheet: 'Tariff',
      })
    );
    expect(mocks.importWitsMfn).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(COUNTRIES)('uses WITS MFN fallback on /$slug-mfn/wits', async ({ dest, slug }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-mfn/wits`,
      payload: { hs6: ['850440'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importWitsMfn).toHaveBeenCalledWith(
      expect.objectContaining({
        dest,
        hs6List: ['850440'],
        dryRun: true,
      })
    );
    expect(mocks.importOfficialMfn).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(COUNTRIES)('uses official FTA importer on /$slug-fta', async ({ dest, slug }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-fta`,
      payload: { agreement: 'ATIGA', partner: 'SG' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: `duties.${slug}.official.fta_excel`,
      fallbackUrl: undefined,
    });
    expect(mocks.importOfficialFta).toHaveBeenCalledWith(
      expect.objectContaining({
        dest,
        agreement: 'ATIGA',
        partner: 'SG',
        urlOrPath: 'https://example.com/source.xlsx',
      })
    );
    expect(mocks.importWitsFta).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(COUNTRIES)('uses WITS FTA fallback on /$slug-fta/wits', async ({ dest, slug }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-fta/wits`,
      payload: { partnerGeoIds: ['SG'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importWitsFta).toHaveBeenCalledWith(
      expect.objectContaining({
        dest,
        partnerGeoIds: ['SG'],
        dryRun: true,
      })
    );
    expect(mocks.importOfficialFta).not.toHaveBeenCalled();
    await app.close();
  });
});
