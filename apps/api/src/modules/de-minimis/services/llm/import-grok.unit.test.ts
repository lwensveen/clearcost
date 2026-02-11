import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpFetchMock: vi.fn(),
  importDeMinimisMock: vi.fn(),
}));

vi.mock('../../../../lib/http.js', () => ({
  httpFetch: mocks.httpFetchMock,
}));

vi.mock('../import-de-minimis.js', () => ({
  importDeMinimis: mocks.importDeMinimisMock,
}));

import { importDeMinimisFromGrok } from './import-grok.js';

describe('importDeMinimisFromGrok', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.XAI_API_KEY = 'test-key';
    mocks.importDeMinimisMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('persists explicit basis from payload rows', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'grok-test',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rows: [
                    {
                      country_code: 'JP',
                      kind: 'VAT',
                      basis: 'INTRINSIC',
                      currency: 'JPY',
                      value: 10000,
                      effective_from: '2025-01-01',
                      effective_to: null,
                      source_url: 'https://www.customs.go.jp',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    await importDeMinimisFromGrok(new Date('2025-01-01T00:00:00.000Z'));

    const [rows] = mocks.importDeMinimisMock.mock.calls[0] ?? [];
    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ dest: 'JP', deMinimisBasis: 'INTRINSIC' })])
    );
  });

  it('fails fast when payload omits basis', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'grok-test',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rows: [
                    {
                      country_code: 'US',
                      kind: 'DUTY',
                      currency: 'USD',
                      value: 800,
                      effective_from: '2025-01-01',
                      effective_to: null,
                      source_url: 'https://www.cbp.gov',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    await expect(importDeMinimisFromGrok(new Date('2025-01-01T00:00:00.000Z'))).rejects.toThrow(
      /basis/i
    );
    expect(mocks.importDeMinimisMock).not.toHaveBeenCalled();
  });

  it('parses rows without ingest side effects when ingest is disabled', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'grok-test',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rows: [
                    {
                      country_code: 'TH',
                      kind: 'DUTY',
                      basis: 'CIF',
                      currency: 'THB',
                      value: 1500,
                      effective_from: '2025-01-01',
                      effective_to: null,
                      source_url: 'https://www.customs.go.th',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const out = await importDeMinimisFromGrok(new Date('2025-01-01T00:00:00.000Z'), {
      ingest: false,
    });

    expect(out).toMatchObject({ inserted: 0, updated: 0, count: 1, usedModel: 'grok-test' });
    expect(out.rows).toHaveLength(1);
    expect(mocks.importDeMinimisMock).not.toHaveBeenCalled();
  });
});
