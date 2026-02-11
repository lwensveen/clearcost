import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpFetchMock: vi.fn(),
  importDeMinimisMock: vi.fn(),
}));

vi.mock('../../../lib/http.js', () => ({
  httpFetch: mocks.httpFetchMock,
}));

vi.mock('./import-de-minimis.js', () => ({
  importDeMinimis: mocks.importDeMinimisMock,
}));

import { importDeMinimisFromTradeGov } from './import-trade-gov.js';

describe('importDeMinimisFromTradeGov', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.importDeMinimisMock.mockResolvedValue({
      ok: true,
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('fails fast when Trade.gov returns no de minimis rows', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    await expect(importDeMinimisFromTradeGov()).rejects.toThrow(/source produced 0 rows/i);
    expect(mocks.importDeMinimisMock).not.toHaveBeenCalled();
  });

  it('imports parsed DUTY/VAT rows when source provides data', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              country: 'CA',
              de_minimis_value: 150,
              de_minimis_currency: 'CAD',
              vat_amount: 40,
              vat_currency: 'CAD',
            },
            {
              country: 'BR',
              de_minimis_value: 50,
              de_minimis_currency: 'USD',
            },
          ],
        }),
        { status: 200 }
      )
    );

    const out = await importDeMinimisFromTradeGov();

    expect(out).toMatchObject({ ok: true, inserted: 1, updated: 0, count: 1 });
    expect(mocks.importDeMinimisMock).toHaveBeenCalledTimes(1);
    const [rows] = mocks.importDeMinimisMock.mock.calls[0] ?? [];
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dest: 'CA',
          deMinimisKind: 'DUTY',
          deMinimisBasis: 'INTRINSIC',
        }),
        expect.objectContaining({
          dest: 'CA',
          deMinimisKind: 'VAT',
          deMinimisBasis: 'INTRINSIC',
        }),
        expect.objectContaining({
          dest: 'BR',
          deMinimisKind: 'DUTY',
          deMinimisBasis: 'CIF',
        }),
      ])
    );
  });
});
