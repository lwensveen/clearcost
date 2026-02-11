import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importOpenAIMock: vi.fn(),
  importGrokMock: vi.fn(),
  importDeMinimisMock: vi.fn(),
}));

vi.mock('./import-openai.js', () => ({
  importDeMinimisFromOpenAI: mocks.importOpenAIMock,
}));

vi.mock('./import-grok.js', () => ({
  importDeMinimisFromGrok: mocks.importGrokMock,
}));

vi.mock('../import-de-minimis.js', () => ({
  importDeMinimis: mocks.importDeMinimisMock,
}));

import { importDeMinimisCrossChecked } from './import-crosscheck.js';

describe('importDeMinimisCrossChecked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.importDeMinimisMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('fetches both models without pre-ingest and ingests reconciled rows once', async () => {
    mocks.importOpenAIMock.mockResolvedValue({
      ok: true,
      inserted: 0,
      updated: 0,
      count: 1,
      usedModel: 'gpt-test',
      rows: [
        {
          country_code: 'US',
          kind: 'DUTY',
          basis: 'INTRINSIC',
          currency: 'USD',
          value: 800,
          effective_from: '2025-01-01',
          effective_to: null,
          source_url: 'https://www.cbp.gov/trade',
        },
      ],
    });

    mocks.importGrokMock.mockResolvedValue({
      ok: true,
      inserted: 0,
      updated: 0,
      count: 1,
      usedModel: 'grok-test',
      rows: [
        {
          country_code: 'US',
          kind: 'DUTY',
          basis: 'INTRINSIC',
          currency: 'USD',
          value: 700,
          effective_from: '2025-01-01',
          effective_to: null,
          source_url: 'https://example.com/unofficial',
        },
      ],
    });

    const out = await importDeMinimisCrossChecked(new Date('2025-01-01T00:00:00.000Z'), {
      importId: 'run-1',
      mode: 'prefer_official',
    });

    expect(mocks.importOpenAIMock).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ ingest: false })
    );
    expect(mocks.importGrokMock).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ ingest: false })
    );

    expect(mocks.importDeMinimisMock).toHaveBeenCalledTimes(1);
    const [rows, options] = mocks.importDeMinimisMock.mock.calls[0] ?? [];
    expect(rows).toEqual([
      expect.objectContaining({
        dest: 'US',
        deMinimisKind: 'DUTY',
        deMinimisBasis: 'INTRINSIC',
        currency: 'USD',
        value: '800',
      }),
    ]);
    expect(options).toEqual(expect.objectContaining({ importId: 'run-1' }));
    expect(out).toMatchObject({ ok: true, count: 1, decided: 1 });
  });
});
