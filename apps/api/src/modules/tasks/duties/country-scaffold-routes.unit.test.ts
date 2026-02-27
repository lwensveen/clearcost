import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceUrl: vi.fn(),
  importOfficialMfn: vi.fn(),
  importOfficialFta: vi.fn(),
}));

vi.mock('../../duty-rates/services/asean/source-urls.js', () => ({
  resolveAseanDutySourceUrl: mocks.resolveSourceUrl,
}));

vi.mock('../../duty-rates/services/asean/shared/import-mfn-official-excel.js', () => ({
  importAseanMfnOfficialFromExcel: mocks.importOfficialMfn,
}));

vi.mock('../../duty-rates/services/asean/shared/import-preferential-official-excel.js', () => ({
  importAseanPreferentialOfficialFromExcel: mocks.importOfficialFta,
}));

import countryScaffoldDutyRoutes from './country-scaffold-routes.js';

const SAMPLE_COUNTRIES = [
  { slug: 'ad', dest: 'AD' },
  { slug: 'za', dest: 'ZA' },
] as const;

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  countryScaffoldDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AD_MFN_OFFICIAL_EXCEL_URL;
  delete process.env.AD_FTA_OFFICIAL_EXCEL_URL;
  delete process.env.ZA_MFN_OFFICIAL_EXCEL_URL;
  delete process.env.ZA_FTA_OFFICIAL_EXCEL_URL;
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
});

describe('country scaffold duties routes', () => {
  it.each(SAMPLE_COUNTRIES)('handles /$slug-mfn official route', async ({ slug, dest }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-mfn`,
      payload: { sheet: 'MFN' },
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
        sheet: 'MFN',
      })
    );
    await app.close();
  });

  it.each(SAMPLE_COUNTRIES)('handles /$slug-fta official route', async ({ slug, dest }) => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/cron/import/duties/${slug}-fta`,
      payload: { agreement: 'Demo FTA', partner: 'SG' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: `duties.${slug}.official.fta_excel`,
      fallbackUrl: undefined,
    });
    expect(mocks.importOfficialFta).toHaveBeenCalledWith(
      expect.objectContaining({
        dest,
        agreement: 'Demo FTA',
        partner: 'SG',
        urlOrPath: 'https://example.com/source.xlsx',
      })
    );
    await app.close();
  });

  it('uses country env fallback when body URL is omitted', async () => {
    process.env.AD_MFN_OFFICIAL_EXCEL_URL = 'https://env.test/ad-mfn.xlsx';
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/ad-mfn',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.ad.official.mfn_excel',
      fallbackUrl: 'https://env.test/ad-mfn.xlsx',
    });
    await app.close();
  });

  it('prefers explicit request URL over country env fallback', async () => {
    process.env.AD_FTA_OFFICIAL_EXCEL_URL = 'https://env.test/ad-fta.xlsx';
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/ad-fta',
      payload: { url: 'https://body.test/ad-fta.xlsx', agreement: 'Demo FTA', partner: 'US' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.ad.official.fta_excel',
      fallbackUrl: 'https://body.test/ad-fta.xlsx',
    });
    await app.close();
  });
});
