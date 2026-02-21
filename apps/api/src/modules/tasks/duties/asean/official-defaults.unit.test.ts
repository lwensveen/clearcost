import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceUrl: vi.fn(),
  importMyMfnFromExcel: vi.fn(),
  importMyPreferentialFromExcel: vi.fn(),
  importMyMfnFromWits: vi.fn(),
  importMyPreferentialFromWits: vi.fn(),
  importVnMfnFromOfficial: vi.fn(),
  importVnPreferentialFromOfficial: vi.fn(),
  importVnMfnFromWits: vi.fn(),
  importVnPreferentialFromWits: vi.fn(),
  importThMfnFromWits: vi.fn(),
  importThPreferentialFromWits: vi.fn(),
  importSgMfnFromWits: vi.fn(),
  importSgPreferentialFromWits: vi.fn(),
}));

vi.mock('../../../duty-rates/services/asean/source-urls.js', () => ({
  resolveAseanDutySourceUrl: mocks.resolveSourceUrl,
}));

vi.mock('../../../duty-rates/services/asean/my/import-mfn-excel.js', () => ({
  importMyMfnFromExcel: mocks.importMyMfnFromExcel,
}));

vi.mock('../../../duty-rates/services/asean/my/import-preferential-excel.js', () => ({
  importMyPreferentialFromExcel: mocks.importMyPreferentialFromExcel,
}));

vi.mock('../../../duty-rates/services/asean/my/import-mfn.js', () => ({
  importMyMfn: mocks.importMyMfnFromWits,
}));

vi.mock('../../../duty-rates/services/asean/my/import-preferential.js', () => ({
  importMyPreferential: mocks.importMyPreferentialFromWits,
}));

vi.mock('../../../duty-rates/services/asean/shared/import-mfn-official-excel.js', () => ({
  importAseanMfnOfficialFromExcel: mocks.importVnMfnFromOfficial,
}));

vi.mock('../../../duty-rates/services/asean/shared/import-preferential-official-excel.js', () => ({
  importAseanPreferentialOfficialFromExcel: mocks.importVnPreferentialFromOfficial,
}));

vi.mock('../../../duty-rates/services/asean/vn/import-mfn.js', () => ({
  importVnMfn: mocks.importVnMfnFromWits,
}));

vi.mock('../../../duty-rates/services/asean/vn/import-preferential.js', () => ({
  importVnPreferential: mocks.importVnPreferentialFromWits,
}));

vi.mock('../../../duty-rates/services/asean/th/import-mfn.js', () => ({
  importThMfn: mocks.importThMfnFromWits,
}));

vi.mock('../../../duty-rates/services/asean/th/import-preferential.js', () => ({
  importThPreferential: mocks.importThPreferentialFromWits,
}));

vi.mock('../../../duty-rates/services/asean/sg/import-mfn.js', () => ({
  importSgMfn: mocks.importSgMfnFromWits,
}));

vi.mock('../../../duty-rates/services/asean/sg/import-preferential.js', () => ({
  importSgPreferential: mocks.importSgPreferentialFromWits,
}));

import myDutyRoutes from './my-routes.js';
import sgDutyRoutes from './sg-routes.js';
import thDutyRoutes from './th-routes.js';
import vnDutyRoutes from './vn-routes.js';

async function buildApp(registerRoutes: (app: FastifyInstance) => void) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  registerRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveSourceUrl.mockResolvedValue('https://example.com/tariff.xlsx');
  mocks.importMyMfnFromExcel.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importMyPreferentialFromExcel.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importMyMfnFromWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importMyPreferentialFromWits.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importVnMfnFromOfficial.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
    dryRun: false,
    scanned: 1,
    kept: 1,
    skipped: 0,
  });
  mocks.importVnPreferentialFromOfficial.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
    dryRun: false,
    scanned: 1,
    kept: 1,
    skipped: 0,
  });
  mocks.importVnMfnFromWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importVnPreferentialFromWits.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importThMfnFromWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importThPreferentialFromWits.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
  mocks.importSgMfnFromWits.mockResolvedValue({ ok: true, inserted: 1, updated: 0, count: 1 });
  mocks.importSgPreferentialFromWits.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
  });
});

describe('asean duties official-first defaults', () => {
  it('uses MY official MFN importer on /my-mfn', async () => {
    const app = await buildApp((server) => myDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/my-mfn',
      payload: { sheet: 'Tariff' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.my.official.mfn_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importMyMfnFromExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/tariff.xlsx',
        sheet: 'Tariff',
      })
    );
    expect(mocks.importMyMfnFromWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses MY WITS fallback on /my-mfn/wits', async () => {
    const app = await buildApp((server) => myDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/my-mfn/wits',
      payload: { hs6: ['850440'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importMyMfnFromWits).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        dryRun: true,
      })
    );
    expect(mocks.importMyMfnFromExcel).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses VN official FTA importer on /vn-fta', async () => {
    const app = await buildApp((server) => vnDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/vn-fta',
      payload: { agreement: 'ATIGA', partner: 'MY' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.vn.official.fta_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importVnPreferentialFromOfficial).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'VN',
        agreement: 'ATIGA',
        partner: 'MY',
        urlOrPath: 'https://example.com/tariff.xlsx',
      })
    );
    expect(mocks.importVnPreferentialFromWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses VN WITS fallback on /vn-fta/wits', async () => {
    const app = await buildApp((server) => vnDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/vn-fta/wits',
      payload: { partnerGeoIds: ['MY'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importVnPreferentialFromWits).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerGeoIds: ['MY'],
        dryRun: true,
      })
    );
    expect(mocks.importVnPreferentialFromOfficial).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses TH official MFN importer on /th-mfn', async () => {
    const app = await buildApp((server) => thDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/th-mfn',
      payload: { sheet: 'Rates' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.th.official.mfn_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importVnMfnFromOfficial).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'TH',
        sheet: 'Rates',
        urlOrPath: 'https://example.com/tariff.xlsx',
      })
    );
    expect(mocks.importThMfnFromWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses TH WITS fallback on /th-fta/wits', async () => {
    const app = await buildApp((server) => thDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/th-fta/wits',
      payload: { partnerGeoIds: ['MY'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importThPreferentialFromWits).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerGeoIds: ['MY'],
        dryRun: true,
      })
    );
    expect(mocks.importVnPreferentialFromOfficial).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses SG official FTA importer on /sg-fta', async () => {
    const app = await buildApp((server) => sgDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/sg-fta',
      payload: { agreement: 'ATIGA', partner: 'TH' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.sg.official.fta_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importVnPreferentialFromOfficial).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'SG',
        agreement: 'ATIGA',
        partner: 'TH',
        urlOrPath: 'https://example.com/tariff.xlsx',
      })
    );
    expect(mocks.importSgPreferentialFromWits).not.toHaveBeenCalled();
    await app.close();
  });

  it('uses SG WITS fallback on /sg-mfn/wits', async () => {
    const app = await buildApp((server) => sgDutyRoutes(server));
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/sg-mfn/wits',
      payload: { hs6: ['850440'], dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.importSgMfnFromWits).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        dryRun: true,
      })
    );
    expect(mocks.importVnMfnFromOfficial).not.toHaveBeenCalled();
    await app.close();
  });
});
