import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMock: vi.fn(),
  importDeMinimisMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mocks.createMock } };
  },
}));

vi.mock('../import-de-minimis.js', () => ({
  importDeMinimis: mocks.importDeMinimisMock,
}));

import { importDeMinimisFromOpenAI } from './import-openai.js';

describe('importDeMinimisFromOpenAI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mocks.importDeMinimisMock.mockResolvedValue({
      inserted: 1,
      updated: 0,
      count: 1,
    });
  });

  it('persists explicit basis from payload rows', async () => {
    mocks.createMock.mockResolvedValue({
      model: 'gpt-test',
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
    });

    await importDeMinimisFromOpenAI(new Date('2025-01-01T00:00:00.000Z'));

    const [rows] = mocks.importDeMinimisMock.mock.calls[0] ?? [];
    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ dest: 'TH', deMinimisBasis: 'CIF' })])
    );
  });

  it('fails fast when payload omits basis', async () => {
    mocks.createMock.mockResolvedValue({
      model: 'gpt-test',
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
    });

    await expect(importDeMinimisFromOpenAI(new Date('2025-01-01T00:00:00.000Z'))).rejects.toThrow(
      /basis/i
    );
    expect(mocks.importDeMinimisMock).not.toHaveBeenCalled();
  });
});
