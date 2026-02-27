import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrl: vi.fn(),
  importOfficialMfnExcel: vi.fn(),
  importOfficialFtaExcel: vi.fn(),
}));

vi.mock('../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrl,
}));

vi.mock('../../duty-rates/services/asean/shared/import-mfn-official-excel.js', () => ({
  importAseanMfnOfficialFromExcel: mocks.importOfficialMfnExcel,
}));

vi.mock('../../duty-rates/services/asean/shared/import-preferential-official-excel.js', () => ({
  importAseanPreferentialOfficialFromExcel: mocks.importOfficialFtaExcel,
}));

import krDutyRoutes from './kr-routes.js';

async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('requireApiKey', () => async () => undefined);
  krDutyRoutes(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveSourceDownloadUrl.mockResolvedValue('https://official.kr/duties.xlsx');
  mocks.importOfficialMfnExcel.mockResolvedValue({
    ok: true,
    inserted: 1,
    updated: 0,
    count: 1,
    dryRun: false,
    scanned: 1,
    kept: 1,
    skipped: 0,
  });
  mocks.importOfficialFtaExcel.mockResolvedValue({
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

describe('kr duties official routes', () => {
  it('uses source-registry-backed official MFN importer on /kr-mfn', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/kr-mfn',
      payload: { sheet: 'MFN' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.kr.official.mfn_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importOfficialMfnExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'KR',
        urlOrPath: 'https://official.kr/duties.xlsx',
        sheet: 'MFN',
      })
    );
    await app.close();
  });

  it('accepts explicit MFN URL on /kr-mfn/official/excel', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/kr-mfn/official/excel',
      payload: { url: 'https://fallback.kr/mfn.xlsx', dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.kr.official.mfn_excel',
      fallbackUrl: 'https://fallback.kr/mfn.xlsx',
    });
    expect(mocks.importOfficialMfnExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'KR',
        dryRun: true,
      })
    );
    await app.close();
  });

  it('uses source-registry-backed official FTA importer on /kr-fta', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/cron/import/duties/kr-fta',
      payload: { agreement: 'KORUS', partner: 'US' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'duties.kr.official.fta_excel',
      fallbackUrl: undefined,
    });
    expect(mocks.importOfficialFtaExcel).toHaveBeenCalledWith(
      expect.objectContaining({
        dest: 'KR',
        agreement: 'KORUS',
        partner: 'US',
      })
    );
    await app.close();
  });
});
